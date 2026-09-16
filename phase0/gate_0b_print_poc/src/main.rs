//! Cheese Corner POS — Gate 0B Isolated Printing Proof-of-Concept
//!
//! This is a standalone headless Rust utility that validates native Win32 print
//! spooler integration for ESC/POS thermal receipt printers. It has ZERO
//! dependencies on OrderRAIL production code, Supabase, or any live data.
//!
//! Usage: test-printer.exe [--printer "POS-58-Series"] [--test all|basic|perf|drawer]
//!
//! SAFETY: This utility uses ONLY synthetic test data. It never connects to
//! production APIs, databases, or live customer data.

use std::time::{Duration, Instant};
use std::io::Write;

// Windows API imports
#[cfg(target_os = "windows")]
use windows::core::PCWSTR;

#[cfg(target_os = "windows")]
use windows::Win32::Graphics::Printing::{
    ClosePrinter, EndDocPrinter, EndPagePrinter, OpenPrinterW, StartDocPrinterW,
    StartPagePrinter, WritePrinter, DOC_INFO_1W, PRINTER_ACCESS_USE,
};

// ============================================================
// ESC/POS Command Constants (Matching OrderRAIL constants.ts)
// ============================================================

const ESC_INIT: &[u8] = b"\x1B\x40";                  // Reset/Initialize
const ESC_ALIGN_LEFT: &[u8] = b"\x1B\x61\x00";        // Align Left
const ESC_ALIGN_CENTER: &[u8] = b"\x1B\x61\x01";      // Align Center
const ESC_BOLD_ON: &[u8] = b"\x1B\x45\x01";           // Bold ON
const ESC_BOLD_OFF: &[u8] = b"\x1B\x45\x00";          // Bold OFF
const ESC_FONT_A: &[u8] = b"\x1B\x4D\x00";            // Font A (12x24)
const ESC_FONT_B: &[u8] = b"\x1B\x4D\x01";            // Font B (9x17)
const ESC_LINE_FEED: &[u8] = b"\x0A";                  // Line Feed
const ESC_FEED_AND_CUT: &[u8] = b"\x1D\x56\x41\x03";  // Feed 3 + Partial Cut
const ESC_CASH_DRAWER: &[u8] = b"\x1B\x70\x00\x19\xFA"; // Drawer Kick (Pin 2)

const COLS_58MM: usize = 32;

// ============================================================
// Helper: Build padded/justified lines for 58mm thermal
// ============================================================

fn center(text: &str, cols: usize) -> String {
    if text.len() >= cols {
        return text[..cols].to_string();
    }
    let pad = (cols - text.len()) / 2;
    format!("{}{}", " ".repeat(pad), text)
}

fn justify(left: &str, right: &str, cols: usize) -> String {
    let space = cols.saturating_sub(left.len() + right.len());
    if space == 0 {
        let trunc = cols.saturating_sub(right.len() + 1);
        return format!("{} {}", &left[..trunc.min(left.len())], right);
    }
    format!("{}{}{}", left, " ".repeat(space), right)
}

fn divider(ch: char, cols: usize) -> String {
    std::iter::repeat(ch).take(cols).collect()
}

// ============================================================
// Synthetic Test Data Generators
// ============================================================

/// Test 1-5: Basic text, alignment, bold, columns, wrapping
fn build_basic_text_test() -> Vec<u8> {
    let mut buf = Vec::new();

    buf.extend_from_slice(ESC_INIT);

    // Test 1: Basic text
    buf.extend_from_slice(ESC_ALIGN_LEFT);
    buf.extend_from_slice(b"Test 1: Basic ASCII Text\n");
    buf.extend_from_slice(b"ABCDEFGHIJKLMNOPQRSTUVWXYZ\n");
    buf.extend_from_slice(b"0123456789!@#%&*()-+=\n");

    // Test 2: Alignment
    buf.extend_from_slice(ESC_ALIGN_LEFT);
    buf.extend_from_slice(b"<< LEFT ALIGNED >>\n");
    buf.extend_from_slice(ESC_ALIGN_CENTER);
    buf.extend_from_slice(b"<< CENTER ALIGNED >>\n");

    // Test 3: Bold
    buf.extend_from_slice(ESC_ALIGN_LEFT);
    buf.extend_from_slice(ESC_BOLD_ON);
    buf.extend_from_slice(b"Test 3: BOLD TEXT ON\n");
    buf.extend_from_slice(ESC_BOLD_OFF);
    buf.extend_from_slice(b"Test 3: Bold OFF (normal)\n");

    // Test 4: Columns (justified text)
    let line = justify("Paneer Tikka x2", "Rs.380.00", COLS_58MM);
    buf.extend_from_slice(line.as_bytes());
    buf.extend_from_slice(ESC_LINE_FEED);

    let line2 = justify("Masala Dosa x1", "Rs.120.00", COLS_58MM);
    buf.extend_from_slice(line2.as_bytes());
    buf.extend_from_slice(ESC_LINE_FEED);

    // Test 5: Long-line wrapping
    buf.extend_from_slice(b"Test 5: This is a very long line that should wrap on a 58mm 32-column thermal printer.\n");

    buf.extend_from_slice(ESC_LINE_FEED);
    buf.extend_from_slice(ESC_LINE_FEED);
    buf.extend_from_slice(ESC_FEED_AND_CUT);

    buf
}

/// Test 6: Itemized KOT
fn build_kot_test() -> Vec<u8> {
    let cols = COLS_58MM;
    let mut buf = Vec::new();

    buf.extend_from_slice(ESC_INIT);
    buf.extend_from_slice(ESC_ALIGN_CENTER);
    buf.extend_from_slice(ESC_BOLD_ON);
    buf.extend_from_slice(b"*** KITCHEN ORDER ***\n");
    buf.extend_from_slice(ESC_BOLD_OFF);

    buf.extend_from_slice(ESC_ALIGN_LEFT);
    buf.extend_from_slice(divider('-', cols).as_bytes());
    buf.extend_from_slice(ESC_LINE_FEED);

    buf.extend_from_slice(format!("{}\n", justify("KOT #: 042", "Table: T-05", cols)).as_bytes());
    buf.extend_from_slice(format!("{}\n", justify("Order #: 1017", "15 Sep 9:30PM", cols)).as_bytes());
    buf.extend_from_slice(divider('-', cols).as_bytes());
    buf.extend_from_slice(ESC_LINE_FEED);

    // Items
    buf.extend_from_slice(ESC_BOLD_ON);
    buf.extend_from_slice(b"2x Cheese Burst Pizza\n");
    buf.extend_from_slice(ESC_BOLD_OFF);
    buf.extend_from_slice(b"   Extra cheese, no olives\n");

    buf.extend_from_slice(ESC_BOLD_ON);
    buf.extend_from_slice(b"1x Veg Manchurian Dry\n");
    buf.extend_from_slice(ESC_BOLD_OFF);
    buf.extend_from_slice(b"   Less spicy\n");

    buf.extend_from_slice(ESC_BOLD_ON);
    buf.extend_from_slice(b"3x Butter Naan\n");
    buf.extend_from_slice(ESC_BOLD_OFF);

    buf.extend_from_slice(divider('-', cols).as_bytes());
    buf.extend_from_slice(ESC_LINE_FEED);
    buf.extend_from_slice(b"Total Items: 6\n");

    buf.extend_from_slice(ESC_LINE_FEED);
    buf.extend_from_slice(ESC_LINE_FEED);
    buf.extend_from_slice(ESC_FEED_AND_CUT);

    buf
}

/// Test 7-8: Bill formatting with Rs. currency
fn build_bill_test() -> Vec<u8> {
    let cols = COLS_58MM;
    let mut buf = Vec::new();

    buf.extend_from_slice(ESC_INIT);

    // Header
    buf.extend_from_slice(ESC_ALIGN_CENTER);
    buf.extend_from_slice(divider('=', cols).as_bytes());
    buf.extend_from_slice(ESC_LINE_FEED);
    buf.extend_from_slice(ESC_BOLD_ON);
    buf.extend_from_slice(b"CHEESE CORNER\n");
    buf.extend_from_slice(ESC_BOLD_OFF);
    buf.extend_from_slice(b"Test Address Line 1\n");
    buf.extend_from_slice(b"Ph: 9876543210\n");
    buf.extend_from_slice(b"GSTIN: 00AAAAA0000A0A0\n");
    buf.extend_from_slice(divider('-', cols).as_bytes());
    buf.extend_from_slice(ESC_LINE_FEED);

    buf.extend_from_slice(ESC_BOLD_ON);
    buf.extend_from_slice(b"PRE-PAYMENT BILL\n");
    buf.extend_from_slice(ESC_BOLD_OFF);
    buf.extend_from_slice(divider('-', cols).as_bytes());
    buf.extend_from_slice(ESC_LINE_FEED);

    buf.extend_from_slice(ESC_ALIGN_LEFT);
    buf.extend_from_slice(format!("{}\n", justify("Bill #: 0104", "Table: T-05", cols)).as_bytes());
    buf.extend_from_slice(format!("{}\n", justify("Order #: 1017", "15 Sep 2026", cols)).as_bytes());
    buf.extend_from_slice(format!("{}\n", justify("Cashier: TestUser", "9:32 PM", cols)).as_bytes());
    buf.extend_from_slice(divider('-', cols).as_bytes());
    buf.extend_from_slice(ESC_LINE_FEED);

    // Items
    buf.extend_from_slice(format!("{}\n", justify("Cheese Pizza x2", "Rs.760.00", cols)).as_bytes());
    buf.extend_from_slice(format!("{}\n", justify("Manchurian Dry x1", "Rs.220.00", cols)).as_bytes());
    buf.extend_from_slice(format!("{}\n", justify("Butter Naan x3", "Rs.150.00", cols)).as_bytes());
    buf.extend_from_slice(format!("{}\n", justify("Cold Coffee x2", "Rs.300.00", cols)).as_bytes());
    buf.extend_from_slice(divider('-', cols).as_bytes());
    buf.extend_from_slice(ESC_LINE_FEED);

    // Totals
    buf.extend_from_slice(format!("{}\n", justify("Subtotal:", "Rs.1430.00", cols)).as_bytes());
    buf.extend_from_slice(format!("{}\n", justify("CGST (2.5%):", "Rs.35.75", cols)).as_bytes());
    buf.extend_from_slice(format!("{}\n", justify("SGST (2.5%):", "Rs.35.75", cols)).as_bytes());
    buf.extend_from_slice(divider('=', cols).as_bytes());
    buf.extend_from_slice(ESC_LINE_FEED);

    buf.extend_from_slice(ESC_BOLD_ON);
    buf.extend_from_slice(format!("{}\n", justify("NET PAYABLE TOTAL:", "Rs.1501.50", cols)).as_bytes());
    buf.extend_from_slice(ESC_BOLD_OFF);

    buf.extend_from_slice(divider('=', cols).as_bytes());
    buf.extend_from_slice(ESC_LINE_FEED);

    // Footer
    buf.extend_from_slice(ESC_ALIGN_CENTER);
    buf.extend_from_slice(b"Thank you for visiting!\n");
    buf.extend_from_slice(b"*** SYNTHETIC TEST DATA ***\n");
    buf.extend_from_slice(b"NOT A REAL BILL\n");

    buf.extend_from_slice(ESC_LINE_FEED);
    buf.extend_from_slice(ESC_LINE_FEED);
    buf.extend_from_slice(ESC_LINE_FEED);
    buf.extend_from_slice(ESC_FEED_AND_CUT);

    buf
}

/// Test 9: Encoding fallback (Rs. instead of Unicode INR symbol)
fn build_encoding_test() -> Vec<u8> {
    let mut buf = Vec::new();
    buf.extend_from_slice(ESC_INIT);
    buf.extend_from_slice(ESC_ALIGN_LEFT);
    buf.extend_from_slice(b"Test 9: Currency Encoding\n");
    buf.extend_from_slice(b"ASCII safe: Rs.1234.56\n");
    buf.extend_from_slice(b"Special chars: @#&*()-+=\n");
    buf.extend_from_slice(b"Numbers: 0123456789\n");
    buf.extend_from_slice(ESC_LINE_FEED);
    buf.extend_from_slice(ESC_FEED_AND_CUT);
    buf
}

// ============================================================
// Win32 Print Spooler Dispatch
// ============================================================

#[cfg(target_os = "windows")]
struct PrintResult {
    success: bool,
    duration: Duration,
    error: Option<String>,
    state: &'static str, // SPOOLER_ACCEPTED, FAILED, etc.
}

#[cfg(target_os = "windows")]
fn dispatch_to_spooler(printer_name: &str, doc_name: &str, data: &[u8]) -> PrintResult {
    let start = Instant::now();

    let printer_wide: Vec<u16> = printer_name.encode_utf16().chain(std::iter::once(0)).collect();
    let doc_wide: Vec<u16> = doc_name.encode_utf16().chain(std::iter::once(0)).collect();
    let raw_wide: Vec<u16> = "RAW".encode_utf16().chain(std::iter::once(0)).collect();

    let mut handle = windows::Win32::Foundation::HANDLE::default();

    // Step 1: Open Printer
    let open_result = unsafe {
        OpenPrinterW(
            PCWSTR(printer_wide.as_ptr()),
            &mut handle,
            None,
        )
    };

    if let Err(e) = open_result {
        return PrintResult {
            success: false,
            duration: start.elapsed(),
            error: Some(format!("OpenPrinterW failed: {}", e)),
            state: "FAILED",
        };
    }

    // Step 2: Start Document
    let doc_info = DOC_INFO_1W {
        pDocName: PCWSTR(doc_wide.as_ptr()),
        pOutputFile: PCWSTR::null(),
        pDatatype: PCWSTR(raw_wide.as_ptr()),
    };

    let doc_id = unsafe { StartDocPrinterW(handle, 1, &doc_info as *const _ as *const _) };
    if doc_id == 0 {
        unsafe { let _ = ClosePrinter(handle); }
        return PrintResult {
            success: false,
            duration: start.elapsed(),
            error: Some("StartDocPrinterW returned 0".to_string()),
            state: "FAILED",
        };
    }

    // Step 3: Start Page
    let page_ok = unsafe { StartPagePrinter(handle) };
    if !page_ok.as_bool() {
        unsafe {
            EndDocPrinter(handle);
            let _ = ClosePrinter(handle);
        }
        return PrintResult {
            success: false,
            duration: start.elapsed(),
            error: Some("StartPagePrinter failed".to_string()),
            state: "FAILED",
        };
    }

    // Step 4: Write Data
    let mut bytes_written: u32 = 0;
    let write_ok = unsafe {
        WritePrinter(
            handle,
            data.as_ptr() as *const _,
            data.len() as u32,
            &mut bytes_written,
        )
    };

    let success = write_ok.as_bool() && bytes_written == data.len() as u32;

    // Step 5: End Page + End Document + Close
    unsafe {
        EndPagePrinter(handle);
        EndDocPrinter(handle);
        let _ = ClosePrinter(handle);
    }

    let elapsed = start.elapsed();

    if success {
        PrintResult {
            success: true,
            duration: elapsed,
            error: None,
            state: "SPOOLER_ACCEPTED",
        }
    } else {
        PrintResult {
            success: false,
            duration: elapsed,
            error: Some(format!(
                "WritePrinter returned {}, wrote {} of {} bytes",
                write_ok.0,
                bytes_written,
                data.len()
            )),
            state: "FAILED",
        }
    }
}

// ============================================================
// Test Runner
// ============================================================

#[cfg(target_os = "windows")]
fn run_test(
    printer: &str,
    test_name: &str,
    test_num: usize,
    data: &[u8],
    results: &mut Vec<(usize, String, bool, Duration, String)>,
) {
    print!("  [{:02}] {} ... ", test_num, test_name);
    std::io::stdout().flush().unwrap();

    let r = dispatch_to_spooler(printer, &format!("Gate0B_Test_{}", test_num), data);
    let status_str = if r.success {
        r.state.to_string()
    } else {
        format!("FAILED: {}", r.error.as_deref().unwrap_or("unknown"))
    };
    println!(
        "{} ({:.1}ms)",
        if r.success { "SPOOLER_ACCEPTED" } else { "FAILED" },
        r.duration.as_secs_f64() * 1000.0
    );
    results.push((test_num, test_name.to_string(), r.success, r.duration, status_str));
}

#[cfg(target_os = "windows")]
fn run_performance_test(
    printer: &str,
    results: &mut Vec<(usize, String, bool, Duration, String)>,
) {
    println!("\n  === PERFORMANCE TEST: 50 Consecutive Dispatches ===");
    let test_data = build_basic_text_test();
    let mut latencies: Vec<Duration> = Vec::with_capacity(50);
    let mut successes = 0u32;
    let mut failures = 0u32;

    for i in 1..=50 {
        let r = dispatch_to_spooler(printer, &format!("Gate0B_Perf_{}", i), &test_data);
        if r.success {
            successes += 1;
            latencies.push(r.duration);
        } else {
            failures += 1;
            println!("    [PERF {:02}] FAILED: {}", i, r.error.as_deref().unwrap_or("unknown"));
        }
    }

    latencies.sort();
    let min = latencies.first().map(|d| d.as_secs_f64() * 1000.0).unwrap_or(0.0);
    let max = latencies.last().map(|d| d.as_secs_f64() * 1000.0).unwrap_or(0.0);
    let mean = if !latencies.is_empty() {
        latencies.iter().map(|d| d.as_secs_f64() * 1000.0).sum::<f64>() / latencies.len() as f64
    } else {
        0.0
    };
    let p95 = if latencies.len() >= 20 {
        latencies[(latencies.len() as f64 * 0.95) as usize].as_secs_f64() * 1000.0
    } else if !latencies.is_empty() {
        latencies.last().unwrap().as_secs_f64() * 1000.0
    } else {
        0.0
    };
    let p99 = if latencies.len() >= 100 {
        latencies[(latencies.len() as f64 * 0.99) as usize].as_secs_f64() * 1000.0
    } else if !latencies.is_empty() {
        latencies.last().unwrap().as_secs_f64() * 1000.0
    } else {
        0.0
    };

    let pass_800ms = p95 <= 800.0;
    println!("\n  Performance Results:");
    println!("    Total Attempts: 50");
    println!("    Successes:      {}", successes);
    println!("    Failures:       {}", failures);
    println!("    Latency Min:    {:.1}ms", min);
    println!("    Latency Max:    {:.1}ms", max);
    println!("    Latency Mean:   {:.1}ms", mean);
    println!("    Latency P95:    {:.1}ms", p95);
    println!("    Latency P99:    {:.1}ms", p99);
    println!(
        "    P95 <= 800ms:   {} {}",
        if pass_800ms { "PASS" } else { "FAIL" },
        if pass_800ms { "✓" } else { "✗" }
    );

    results.push((
        99,
        "Performance (50 runs)".to_string(),
        successes == 50 && pass_800ms,
        Duration::from_secs_f64(mean / 1000.0),
        format!(
            "S={} F={} min={:.1}ms max={:.1}ms mean={:.1}ms p95={:.1}ms p99={:.1}ms",
            successes, failures, min, max, mean, p95, p99
        ),
    ));
}

#[cfg(target_os = "windows")]
fn main() {
    println!("============================================================");
    println!("  Cheese Corner POS — Gate 0B Printing PoC");
    println!("  ISOLATED TEST UTILITY — SYNTHETIC DATA ONLY");
    println!("  NO PRODUCTION CONNECTIONS");
    println!("============================================================\n");

    let args: Vec<String> = std::env::args().collect();
    let printer_name = args
        .iter()
        .position(|a| a == "--printer")
        .and_then(|i| args.get(i + 1))
        .map(|s| s.as_str())
        .unwrap_or("POS-58-Series");

    let test_mode = args
        .iter()
        .position(|a| a == "--test")
        .and_then(|i| args.get(i + 1))
        .map(|s| s.as_str())
        .unwrap_or("all");

    let enable_drawer = args.iter().any(|a| a == "--enable-drawer");

    println!("  Target Printer: {}", printer_name);
    println!("  Test Mode:      {}", test_mode);
    println!("  Drawer Test:    {}", if enable_drawer { "ENABLED (operator approved)" } else { "DISABLED (safe default)" });
    println!();

    let mut results: Vec<(usize, String, bool, Duration, String)> = Vec::new();

    // === Functional Tests ===
    if test_mode == "all" || test_mode == "basic" {
        println!("--- Functional Test Suite ---\n");

        run_test(printer_name, "Basic Text + Alignment + Bold + Columns + Wrapping", 1, &build_basic_text_test(), &mut results);
        run_test(printer_name, "Itemized KOT (Kitchen Order Ticket)", 6, &build_kot_test(), &mut results);
        run_test(printer_name, "Bill Formatting with Rs. Currency", 7, &build_bill_test(), &mut results);
        run_test(printer_name, "Encoding Fallback (ASCII Rs.)", 9, &build_encoding_test(), &mut results);

        // Test 12: Paper Cut (already included in each test)
        println!("  [12] Paper Cut ... (included in every test via ESC_FEED_AND_CUT)");

        // Test 14: Printer disconnected
        println!("\n  [14] Printer Disconnected Test:");
        let fake_data = build_basic_text_test();
        run_test("NONEXISTENT_PRINTER_XYZ", "Dispatch to non-existent printer", 14, &fake_data, &mut results);
    }

    // === Performance Test ===
    if test_mode == "all" || test_mode == "perf" {
        run_performance_test(printer_name, &mut results);
    }

    // === Cash Drawer Test (only with explicit flag) ===
    if enable_drawer {
        println!("\n--- Cash Drawer Solenoid Test ---\n");
        println!("  WARNING: Physical drawer will open. Ensure area is clear.");

        let mut drawer_buf = Vec::new();
        drawer_buf.extend_from_slice(ESC_INIT);
        drawer_buf.extend_from_slice(ESC_CASH_DRAWER);
        run_test(printer_name, "Cash Drawer Kick Pulse", 20, &drawer_buf, &mut results);
    }

    // === Summary ===
    println!("\n============================================================");
    println!("  TEST SUMMARY");
    println!("============================================================\n");

    let total = results.len();
    let passed = results.iter().filter(|r| r.2).count();
    let failed = total - passed;

    for (num, name, success, dur, detail) in &results {
        println!(
            "  [{:02}] {} — {} ({:.1}ms) {}",
            num,
            if *success { "PASS" } else { "FAIL" },
            name,
            dur.as_secs_f64() * 1000.0,
            if *success { "" } else { detail }
        );
    }

    println!("\n  Total: {}  Passed: {}  Failed: {}", total, passed, failed);
    let overall = if failed == 0 { "GATE 0B: PASS" } else { "GATE 0B: FAIL" };
    println!("  {}", overall);
    println!("\n============================================================\n");
}

#[cfg(not(target_os = "windows"))]
fn main() {
    eprintln!("ERROR: This utility requires Windows with winspool.drv.");
    eprintln!("       Gate 0B validation must run on the target Windows POS terminal.");
    std::process::exit(1);
}
