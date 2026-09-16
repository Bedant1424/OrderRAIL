// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct NativePrintResponse {
    pub status: String, // "SPOOLER_ACCEPTED"
    pub job_id: String,
    pub bytes_written: usize,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct NativePrintError {
    pub code: String,
    pub message: String,
}

/// Enumerates installed Windows printers using EnumPrintersW
#[tauri::command]
fn list_printers() -> Result<Vec<String>, NativePrintError> {
    #[cfg(windows)]
    {
        use std::ffi::OsString;
        use std::os::windows::ffi::OsStringExt;
        use windows_sys::Win32::Graphics::Printing::{
            EnumPrintersW, PRINTER_ENUM_CONNECTIONS, PRINTER_ENUM_LOCAL, PRINTER_INFO_4W,
        };

        let mut bytes_needed: u32 = 0;
        let mut printers_returned: u32 = 0;
        let flags = PRINTER_ENUM_LOCAL | PRINTER_ENUM_CONNECTIONS;

        unsafe {
            // First call to determine required buffer size
            EnumPrintersW(
                flags,
                std::ptr::null_mut(),
                4, // PRINTER_INFO_4
                std::ptr::null_mut(),
                0,
                &mut bytes_needed,
                &mut printers_returned,
            );

            if bytes_needed == 0 {
                return Ok(Vec::new());
            }

            let mut buffer = vec![0u8; bytes_needed as usize];
            let success = EnumPrintersW(
                flags,
                std::ptr::null_mut(),
                4,
                buffer.as_mut_ptr(),
                bytes_needed,
                &mut bytes_needed,
                &mut printers_returned,
            );

            if success == 0 {
                return Err(NativePrintError {
                    code: "PRINTER_ENUM_FAILED".to_string(),
                    message: "Failed to enumerate Windows printers via EnumPrintersW.".to_string(),
                });
            }

            let p_info_array = buffer.as_ptr() as *const PRINTER_INFO_4W;
            let mut printer_names = Vec::new();

            for i in 0..printers_returned as usize {
                let info = *p_info_array.add(i);
                if !info.pPrinterName.is_null() {
                    let mut len = 0;
                    while *info.pPrinterName.add(len) != 0 {
                        len += 1;
                    }
                    let slice = std::slice::from_raw_parts(info.pPrinterName, len);
                    if let Ok(name) = OsString::from_wide(slice).into_string() {
                        printer_names.push(name);
                    }
                }
            }

            Ok(printer_names)
        }
    }

    #[cfg(not(windows))]
    {
        Ok(vec!["POS-58-Series (Simulated)".to_string()])
    }
}

/// Dispatches raw ESC/POS byte buffers directly to the Windows Print Spooler using RAW datatype
#[tauri::command]
fn print_raw_escpos(
    printer_name: String,
    payload: Vec<u8>,
    job_title: Option<String>,
) -> Result<NativePrintResponse, NativePrintError> {
    if printer_name.trim().is_empty() {
        return Err(NativePrintError {
            code: "PRINTER_NOT_FOUND".to_string(),
            message: "Printer name cannot be empty.".to_string(),
        });
    }

    if payload.is_empty() {
        return Err(NativePrintError {
            code: "INVALID_PAYLOAD".to_string(),
            message: "ESC/POS payload buffer cannot be empty.".to_string(),
        });
    }

    #[cfg(windows)]
    {
        use std::ffi::c_void;
        use std::os::windows::ffi::OsStrExt;
        use windows_sys::Win32::Foundation::{GetLastError, HANDLE};
        use windows_sys::Win32::Graphics::Printing::{
            ClosePrinter, EndDocPrinter, EndPagePrinter, OpenPrinterW, StartDocPrinterW,
            StartPagePrinter, WritePrinter, DOC_INFO_1W,
        };

        let mut printer_name_wide: Vec<u16> = std::ffi::OsStr::new(&printer_name)
            .encode_wide()
            .chain(std::iter::once(0))
            .collect();

        let title = job_title.unwrap_or_else(|| "Receipt".to_string());
        let mut title_wide: Vec<u16> = std::ffi::OsStr::new(&title)
            .encode_wide()
            .chain(std::iter::once(0))
            .collect();

        let mut raw_datatype_wide: Vec<u16> = std::ffi::OsStr::new("RAW")
            .encode_wide()
            .chain(std::iter::once(0))
            .collect();

        let mut h_printer: HANDLE = 0;

        unsafe {
            // 1. Open printer handle
            let open_res = OpenPrinterW(
                printer_name_wide.as_mut_ptr(),
                &mut h_printer,
                std::ptr::null_mut(),
            );

            if open_res == 0 || h_printer == 0 {
                let err_code = GetLastError();
                let (code_str, msg) = match err_code {
                    5 => (
                        "ACCESS_DENIED",
                        "Access denied opening Windows printer spooler handle.",
                    ),
                    1801 => (
                        "PRINTER_NOT_FOUND",
                        "The specified printer name is invalid or does not exist.",
                    ),
                    _ => (
                        "SPOOLER_UNAVAILABLE",
                        "Unable to open Windows printer. Spooler may be stopped or unavailable.",
                    ),
                };
                return Err(NativePrintError {
                    code: code_str.to_string(),
                    message: format!("{} (Win32 Error: {})", msg, err_code),
                });
            }

            // 2. Start document with RAW datatype
            let mut doc_info = DOC_INFO_1W {
                pDocName: title_wide.as_mut_ptr(),
                pOutputFile: std::ptr::null_mut(),
                pDatatype: raw_datatype_wide.as_mut_ptr(),
            };

            let job_id = StartDocPrinterW(h_printer, 1, &mut doc_info as *mut _ as *mut u8);
            if job_id == 0 {
                let err_code = GetLastError();
                ClosePrinter(h_printer);
                return Err(NativePrintError {
                    code: "SPOOLER_UNAVAILABLE".to_string(),
                    message: format!(
                        "StartDocPrinterW failed. Spooler rejected RAW print job (Win32 Error: {}).",
                        err_code
                    ),
                });
            }

            // 3. Start page
            let page_res = StartPagePrinter(h_printer);
            if page_res == 0 {
                let err_code = GetLastError();
                EndDocPrinter(h_printer);
                ClosePrinter(h_printer);
                return Err(NativePrintError {
                    code: "NATIVE_ERROR".to_string(),
                    message: format!("StartPagePrinter failed (Win32 Error: {}).", err_code),
                });
            }

            // 4. Write RAW bytes
            let mut bytes_written: u32 = 0;
            let write_res = WritePrinter(
                h_printer,
                payload.as_ptr() as *const c_void,
                payload.len() as u32,
                &mut bytes_written,
            );

            // Cleanly finish page and doc, and close printer handle
            EndPagePrinter(h_printer);
            EndDocPrinter(h_printer);
            ClosePrinter(h_printer);

            if write_res == 0 || bytes_written == 0 {
                let err_code = GetLastError();
                return Err(NativePrintError {
                    code: "NATIVE_ERROR".to_string(),
                    message: format!("WritePrinter failed to send bytes to spooler (Win32 Error: {}).", err_code),
                });
            }

            Ok(NativePrintResponse {
                status: "SPOOLER_ACCEPTED".to_string(),
                job_id: format!("win-spool-{}", job_id),
                bytes_written: bytes_written as usize,
            })
        }
    }

    #[cfg(not(windows))]
    {
        Ok(NativePrintResponse {
            status: "SPOOLER_ACCEPTED".to_string(),
            job_id: format!("sim-spool-{}", std::time::SystemTime::now().elapsed().unwrap_or_default().as_millis()),
            bytes_written: payload.len(),
        })
    }
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![list_printers, print_raw_escpos])
        .run(tauri::generate_context!())
        .expect("error while running Cheese Corner POS application");
}
