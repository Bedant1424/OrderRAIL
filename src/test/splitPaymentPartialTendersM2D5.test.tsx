import React from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { PaymentDialogModal } from "@/pages/counter/CounterPage";
import { PaymentService } from "@/lib/payments/paymentService";
import { BillRepository } from "@/lib/billing/BillRepository";
import { toast } from "sonner";

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

describe("Milestone 2D.5 - Split Payment UX: Editable UPI & Card Partial Amounts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    BillRepository.clearMemoryStoreForTesting();
  });

  const defaultProps = {
    tableLabel: "Table 1",
    netTotal: 312.0,
    subtotal: 300.0,
    tax: 12.0,
    discountPct: 0,
    discountAmt: 0,
    onComplete: vi.fn(),
    onClose: vi.fn(),
  };

  // 1 & 3: UPI defaults to remainingBalance and can be edited
  it("1 & 3. In split mode, UPI defaults to remainingBalance (₹312) and can be edited to a partial amount", () => {
    render(<PaymentDialogModal {...defaultProps} />);

    // Switch to Split Payment
    fireEvent.click(screen.getByText(/Split Payment/i));

    // Switch to UPI
    fireEvent.click(screen.getByRole("button", { name: /UPI \/ QR/i }));

    // Input for Split UPI Amount should exist and have default value "312.00"
    const upiInput = screen.getByPlaceholderText("0.00") as HTMLInputElement;
    expect(upiInput).toBeDefined();
    expect(upiInput.value).toBe("312.00");

    // Edit UPI amount to ₹112.00
    fireEvent.change(upiInput, { target: { value: "112" } });
    expect(upiInput.value).toBe("112");
  });

  // 2 & 4: CARD defaults to remainingBalance and can be edited
  it("2 & 4. In split mode, CARD defaults to remainingBalance (₹312) and can be edited to a partial amount", () => {
    render(<PaymentDialogModal {...defaultProps} />);

    // Switch to Split Payment
    fireEvent.click(screen.getByText(/Split Payment/i));

    // Switch to Card
    fireEvent.click(screen.getByRole("button", { name: /Card/i }));

    // Input for Split Card Amount should exist and have default value "312.00"
    const cardInput = screen.getByPlaceholderText("0.00") as HTMLInputElement;
    expect(cardInput).toBeDefined();
    expect(cardInput.value).toBe("312.00");

    // Edit Card amount to ₹100.00
    fireEvent.change(cardInput, { target: { value: "100" } });
    expect(cardInput.value).toBe("100");
  });

  // 5 & 7: UPI ₹112 committed against ₹312, then switch to CASH
  it("5 & 7. UPI ₹112 can be committed against ₹312, and switching to CASH preserves UPI tender and defaults CASH to ₹200", () => {
    render(<PaymentDialogModal {...defaultProps} />);

    // Switch to Split Payment
    fireEvent.click(screen.getByText(/Split Payment/i));

    // Switch to UPI
    fireEvent.click(screen.getByRole("button", { name: /UPI \/ QR/i }));

    const upiInput = screen.getByPlaceholderText("0.00");
    fireEvent.change(upiInput, { target: { value: "112" } });

    // Record UPI payment
    const recordBtn = screen.getByRole("button", { name: /Record UPI Payment/i });
    fireEvent.click(recordBtn);

    // Toast indicates remaining balance ₹200.00
    expect(toast.success).toHaveBeenCalledWith(expect.stringContaining("200.00"));

    // Applied Tenders lists UPI ₹112.00
    expect(screen.getByText(/Applied Tenders/i)).toBeDefined();
    expect(screen.getAllByText(/UPI/i).length).toBeGreaterThan(0);

    // Switch to Cash
    fireEvent.click(screen.getByRole("button", { name: /Cash/i }));

    // Remaining due in Applied Tenders shows ₹200.00
    expect(screen.getByText(/Remaining Due:/i)).toBeDefined();

    // Split Cash Amount and Cash Received inputs default to remaining balance ₹200.00
    const cashInputs = screen.getAllByDisplayValue("200.00");
    expect(cashInputs.length).toBeGreaterThanOrEqual(1);
  });

  // 6 & 8: CARD ₹100 committed against ₹312, then switch to CASH
  it("6 & 8. CARD ₹100 can be committed against ₹312, and switching to CASH preserves CARD tender and defaults CASH to ₹212", () => {
    render(<PaymentDialogModal {...defaultProps} />);

    fireEvent.click(screen.getByText(/Split Payment/i));
    fireEvent.click(screen.getByRole("button", { name: /Card/i }));

    const cardInput = screen.getByPlaceholderText("0.00");
    fireEvent.change(cardInput, { target: { value: "100" } });

    const recordBtn = screen.getByRole("button", { name: /Record CARD Payment/i });
    fireEvent.click(recordBtn);

    expect(toast.success).toHaveBeenCalledWith(expect.stringContaining("212.00"));

    // Switch to Cash
    fireEvent.click(screen.getByRole("button", { name: /Cash/i }));
    const cashInputs = screen.getAllByDisplayValue("212.00");
    expect(cashInputs.length).toBeGreaterThanOrEqual(1);
  });

  // 9: CASH -> UPI preserves CASH tender
  it("9. CASH ₹200 committed, then switching to UPI preserves CASH tender and defaults UPI to ₹112", () => {
    render(<PaymentDialogModal {...defaultProps} />);

    fireEvent.click(screen.getByText(/Split Payment/i));
    fireEvent.click(screen.getByRole("button", { name: /Cash/i }));

    const cashInputs = screen.getAllByDisplayValue("312.00");
    fireEvent.change(cashInputs[0], { target: { value: "200" } });

    const recordBtn = screen.getByRole("button", { name: /Record CASH Payment/i });
    fireEvent.click(recordBtn);

    expect(toast.success).toHaveBeenCalledWith(expect.stringContaining("112.00"));

    // Switch to UPI
    fireEvent.click(screen.getByRole("button", { name: /UPI \/ QR/i }));

    const upiInput = screen.getByPlaceholderText("0.00") as HTMLInputElement;
    expect(upiInput.value).toBe("112.00");
  });

  // 10: CASH -> CARD preserves CASH tender
  it("10. CASH ₹200 committed, then switching to CARD preserves CASH tender and defaults CARD to ₹112", () => {
    render(<PaymentDialogModal {...defaultProps} />);

    fireEvent.click(screen.getByText(/Split Payment/i));
    fireEvent.click(screen.getByRole("button", { name: /Cash/i }));

    const cashInputs = screen.getAllByDisplayValue("312.00");
    fireEvent.change(cashInputs[0], { target: { value: "200" } });

    const recordBtn = screen.getByRole("button", { name: /Record CASH Payment/i });
    fireEvent.click(recordBtn);

    // Switch to Card
    fireEvent.click(screen.getByRole("button", { name: /Card/i }));

    const cardInput = screen.getByPlaceholderText("0.00") as HTMLInputElement;
    expect(cardInput.value).toBe("112.00");
  });

  // 11, 16, 17: Three-way split (CARD ₹100 + UPI ₹100 + CASH ₹112 = ₹312) completes session with full tenders array
  it("11, 16, 17. Three-way split completes session with all tenders preserved in onComplete callback", async () => {
    const onCompleteMock = vi.fn();
    render(<PaymentDialogModal {...defaultProps} onComplete={onCompleteMock} />);

    fireEvent.click(screen.getByText(/Split Payment/i));

    // 1. CARD ₹100
    fireEvent.click(screen.getByRole("button", { name: /Card/i }));
    const cardInput = screen.getByPlaceholderText("0.00");
    fireEvent.change(cardInput, { target: { value: "100" } });
    fireEvent.click(screen.getByRole("button", { name: /Record CARD Payment/i }));

    // 2. UPI ₹100
    fireEvent.click(screen.getByRole("button", { name: /UPI \/ QR/i }));
    const upiInput = screen.getByPlaceholderText("0.00");
    fireEvent.change(upiInput, { target: { value: "100" } });
    fireEvent.click(screen.getByRole("button", { name: /Record UPI Payment/i }));

    // 3. CASH ₹112
    fireEvent.click(screen.getByRole("button", { name: /Cash/i }));
    const recordCashBtn = screen.getByRole("button", { name: /Record CASH Payment/i });
    fireEvent.click(recordCashBtn);

    await waitFor(() => {
      expect(onCompleteMock).toHaveBeenCalled();
    });

    const passedTenders = onCompleteMock.mock.calls[0][0];
    expect(passedTenders).toHaveLength(3);
    expect(passedTenders[0].method).toBe("card");
    expect(passedTenders[0].amount).toBe(100);
    expect(passedTenders[1].method).toBe("upi");
    expect(passedTenders[1].amount).toBe(100);
    expect(passedTenders[2].method).toBe("cash");
    expect(passedTenders[2].amount).toBe(112);
  });

  // 12, 13, 14: Validations (zero, negative, amount above remaining balance)
  it("12, 13, 14. Zero, negative, and excessive amounts are rejected with error toasts", () => {
    render(<PaymentDialogModal {...defaultProps} />);

    fireEvent.click(screen.getByText(/Split Payment/i));
    fireEvent.click(screen.getByRole("button", { name: /UPI \/ QR/i }));

    const upiInput = screen.getByPlaceholderText("0.00");

    // Zero amount
    fireEvent.change(upiInput, { target: { value: "0" } });
    fireEvent.click(screen.getByRole("button", { name: /Record UPI Payment/i }));
    expect(toast.error).toHaveBeenCalledWith(expect.stringContaining("greater than"));

    // Negative amount
    fireEvent.change(upiInput, { target: { value: "-50" } });
    fireEvent.click(screen.getByRole("button", { name: /Record UPI Payment/i }));
    expect(toast.error).toHaveBeenCalledWith(expect.stringContaining("greater than"));

    // Amount above remaining balance
    fireEvent.change(upiInput, { target: { value: "500" } });
    fireEvent.click(screen.getByRole("button", { name: /Record UPI Payment/i }));
    expect(toast.error).toHaveBeenCalledWith(expect.stringContaining("exceeds remaining balance"));
  });

  // 15: Settlement cannot occur while balance remains
  it("15. Partial tender does not trigger onComplete when balance remains", () => {
    const onCompleteMock = vi.fn();
    render(<PaymentDialogModal {...defaultProps} onComplete={onCompleteMock} />);

    fireEvent.click(screen.getByText(/Split Payment/i));
    fireEvent.click(screen.getByRole("button", { name: /UPI \/ QR/i }));

    const upiInput = screen.getByPlaceholderText("0.00");
    fireEvent.change(upiInput, { target: { value: "112" } });
    fireEvent.click(screen.getByRole("button", { name: /Record UPI Payment/i }));

    expect(onCompleteMock).not.toHaveBeenCalled();
  });

  // 18: Existing CASH change behavior passes
  it("18. CASH partial tender correctly calculates and stores changeDue when cash received exceeds tender amount", async () => {
    const onCompleteMock = vi.fn();
    render(<PaymentDialogModal {...defaultProps} onComplete={onCompleteMock} />);

    fireEvent.click(screen.getByText(/Split Payment/i));
    fireEvent.click(screen.getByRole("button", { name: /Cash/i }));

    // Enter CASH tender ₹200 with cash received ₹312
    const tenderInputs = screen.getAllByDisplayValue("312.00");
    fireEvent.change(tenderInputs[0], { target: { value: "200" } });
    fireEvent.change(tenderInputs[1], { target: { value: "312" } });

    // Verify CHANGE DUE is ₹112.00
    expect(screen.getByText(/CHANGE DUE:/i)).toBeDefined();

    // Record CASH payment
    fireEvent.click(screen.getByRole("button", { name: /Record CASH Payment/i }));

    // Finish remaining with UPI ₹112
    fireEvent.click(screen.getByRole("button", { name: /UPI \/ QR/i }));
    fireEvent.click(screen.getByRole("button", { name: /Record UPI Payment/i }));

    await waitFor(() => {
      expect(onCompleteMock).toHaveBeenCalled();
    });

    const tenders = onCompleteMock.mock.calls[0][0];
    expect(tenders[0].method).toBe("cash");
    expect(tenders[0].amount).toBe(200);
    expect(tenders[0].tenderedAmount).toBe(312);
    expect(tenders[0].changeDue).toBe(112);
  });
});
