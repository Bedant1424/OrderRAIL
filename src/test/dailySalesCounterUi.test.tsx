import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DailySalesPill } from "@/components/counter/DailySalesPill";
import { DailySalesModal } from "@/components/counter/DailySalesModal";
import type { DailySalesReport } from "@/lib/sales/types";

describe("Milestone 2B.3: Counter Daily Sales UI & Rollover Tests", () => {
  const CAFE_ID = "6d00d671-eaea-47ce-a842-f970878373c9";

  const mockDay1Report: DailySalesReport = {
    business_date: "2026-08-21",
    cafe_id: CAFE_ID,
    net_collected: 14850,
    gross_subtotal: 14200,
    total_discounts: 450,
    total_tax: 710,
    cgst: 355,
    sgst: 355,
    total_service_charge: 390,
    total_round_off: 0,
    paid_bills_count: 32,
    total_items_sold: 84,
    average_bill_value: 464.06,
    tenders: {
      cash: 5200,
      upi: 8450,
      card: 1200,
      other: 0,
    },
    pipeline: {
      unsettled_orders_count: 2,
      unsettled_pipeline_cents: 113100,
      cancelled_orders_count: 1,
    },
  };

  const mockDay2ZeroReport: DailySalesReport = {
    business_date: "2026-08-22",
    cafe_id: CAFE_ID,
    net_collected: 0,
    gross_subtotal: 0,
    total_discounts: 0,
    total_tax: 0,
    cgst: 0,
    sgst: 0,
    total_service_charge: 0,
    total_round_off: 0,
    paid_bills_count: 0,
    total_items_sold: 0,
    average_bill_value: 0,
    tenders: {
      cash: 0,
      upi: 0,
      card: 0,
      other: 0,
    },
    pipeline: {
      unsettled_orders_count: 0,
      unsettled_pipeline_cents: 0,
      cancelled_orders_count: 0,
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // 1. Pill loading state
  it("1. DailySalesPill renders loading skeleton when isLoading is true and no report exists", () => {
    render(
      <DailySalesPill
        report={null}
        isLoading={true}
        isError={false}
      />
    );

    expect(screen.getByTestId("daily-sales-pill-loading")).toBeInTheDocument();
    expect(screen.queryByTestId("daily-sales-pill")).not.toBeInTheDocument();
    expect(screen.queryByText(/₹0/)).not.toBeInTheDocument(); // Never show false ₹0 while loading
  });

  // 2. Pill success state
  it("2. DailySalesPill renders net collected amount and paid bills count on success", () => {
    const handleClick = vi.fn();
    render(
      <DailySalesPill
        report={mockDay1Report}
        isLoading={false}
        isError={false}
        onClick={handleClick}
      />
    );

    const pill = screen.getByTestId("daily-sales-pill");
    expect(pill).toBeInTheDocument();
    expect(screen.getByTestId("daily-sales-pill-amount")).toHaveTextContent(/14,850/);
    expect(screen.getByTestId("daily-sales-pill-bills")).toHaveTextContent("· 32 Bills");

    fireEvent.click(pill);
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  // 3. Pill zero-sales state
  it("3. DailySalesPill renders legitimate ₹0.00 and 0 Bills for zero sales report", () => {
    render(
      <DailySalesPill
        report={mockDay2ZeroReport}
        isLoading={false}
        isError={false}
      />
    );

    expect(screen.getByTestId("daily-sales-pill-amount")).toHaveTextContent(/0/);
    expect(screen.getByTestId("daily-sales-pill-bills")).toHaveTextContent("· 0 Bills");
  });

  // 4 & 5. Pill error state and retry
  it("4 & 5. DailySalesPill renders error indicator on failure and triggers retry on click", () => {
    const handleRetry = vi.fn();
    render(
      <DailySalesPill
        report={null}
        isLoading={false}
        isError={true}
        onRetry={handleRetry}
      />
    );

    const errorBtn = screen.getByTestId("daily-sales-pill-error");
    expect(errorBtn).toBeInTheDocument();
    expect(screen.getByText("Sales Error")).toBeInTheDocument();

    fireEvent.click(errorBtn);
    expect(handleRetry).toHaveBeenCalledTimes(1);
  });

  // 6 & 7. Modal displays authoritative business date
  it("6 & 7. DailySalesModal renders authoritative business date from report", () => {
    render(
      <DailySalesModal
        isOpen={true}
        onClose={vi.fn()}
        report={mockDay1Report}
        isLoading={false}
        isError={false}
        onRefresh={vi.fn()}
      />
    );

    expect(screen.getByTestId("daily-sales-modal")).toBeInTheDocument();
    expect(screen.getByTestId("daily-sales-business-date")).toHaveTextContent(/21 Aug 2026/);
  });

  // 8, 9, 10. Net collected, paid bills count, and average bill value
  it("8, 9, 10. DailySalesModal renders primary realized metrics: Net Collected, Paid Bills, Avg Bill", () => {
    render(
      <DailySalesModal
        isOpen={true}
        onClose={vi.fn()}
        report={mockDay1Report}
        isLoading={false}
        isError={false}
        onRefresh={vi.fn()}
      />
    );

    expect(screen.getByTestId("daily-sales-net-collected")).toHaveTextContent(/14,850/);
    expect(screen.getByTestId("daily-sales-paid-count")).toHaveTextContent("32");
    expect(screen.getByTestId("daily-sales-avg-bill")).toHaveTextContent(/464.06/);
    expect(screen.getByTestId("daily-sales-items-sold")).toHaveTextContent("84");
  });

  // 11. Tender breakdown (Cash, UPI, Card, Other)
  it("11. DailySalesModal displays individual tender totals", () => {
    render(
      <DailySalesModal
        isOpen={true}
        onClose={vi.fn()}
        report={mockDay1Report}
        isLoading={false}
        isError={false}
        onRefresh={vi.fn()}
      />
    );

    expect(screen.getByTestId("daily-sales-tender-cash")).toHaveTextContent(/5,200/);
    expect(screen.getByTestId("daily-sales-tender-upi")).toHaveTextContent(/8,450/);
    expect(screen.getByTestId("daily-sales-tender-card")).toHaveTextContent(/1,200/);
    expect(screen.getByTestId("daily-sales-tender-other")).toHaveTextContent(/0/);
  });

  // 12. Financial subtotal and tax breakdown
  it("12. DailySalesModal displays gross subtotal, discounts, and GST breakdown", () => {
    render(
      <DailySalesModal
        isOpen={true}
        onClose={vi.fn()}
        report={mockDay1Report}
        isLoading={false}
        isError={false}
        onRefresh={vi.fn()}
      />
    );

    expect(screen.getByTestId("daily-sales-gross-subtotal")).toHaveTextContent(/14,200/);
    expect(screen.getByTestId("daily-sales-discounts")).toHaveTextContent(/450/);
    expect(screen.getByTestId("daily-sales-tax")).toHaveTextContent(/710/);
    expect(screen.getByTestId("daily-sales-tax")).toHaveTextContent(/CGST: ₹355/);
    expect(screen.getByTestId("daily-sales-tax")).toHaveTextContent(/SGST: ₹355/);
  });

  // 13. Operational pipeline separation (Unsettled orders, amount, cancelled orders)
  it("13. DailySalesModal renders operational pipeline in distinct section separated from realized collections", () => {
    render(
      <DailySalesModal
        isOpen={true}
        onClose={vi.fn()}
        report={mockDay1Report}
        isLoading={false}
        isError={false}
        onRefresh={vi.fn()}
      />
    );

    const pipelineSec = screen.getByTestId("daily-sales-pipeline-section");
    expect(pipelineSec).toBeInTheDocument();
    expect(pipelineSec).toHaveTextContent("Not included in Collections");

    expect(screen.getByTestId("daily-sales-unsettled-count")).toHaveTextContent("2 Orders");
    expect(screen.getByTestId("daily-sales-unsettled-value")).toHaveTextContent(/1,131/);
    expect(screen.getByTestId("daily-sales-cancelled-count")).toHaveTextContent("1 Order");
  });

  // 14. Rollover update while modal is open
  it("14. When report rolls over while modal is open, modal smoothly displays the new business date and zero metrics", () => {
    const { rerender } = render(
      <DailySalesModal
        isOpen={true}
        onClose={vi.fn()}
        report={mockDay1Report}
        isLoading={false}
        isError={false}
        onRefresh={vi.fn()}
      />
    );

    expect(screen.getByTestId("daily-sales-business-date")).toHaveTextContent(/21 Aug 2026/);
    expect(screen.getByTestId("daily-sales-net-collected")).toHaveTextContent(/14,850/);

    // Re-render with Day 2 rolled-over zero report
    rerender(
      <DailySalesModal
        isOpen={true}
        onClose={vi.fn()}
        report={mockDay2ZeroReport}
        isLoading={false}
        isError={false}
        onRefresh={vi.fn()}
      />
    );

    expect(screen.getByTestId("daily-sales-business-date")).toHaveTextContent(/22 Aug 2026/);
    expect(screen.getByTestId("daily-sales-net-collected")).toHaveTextContent(/0/);
    expect(screen.getByTestId("daily-sales-paid-count")).toHaveTextContent("0");
    expect(screen.getByTestId("daily-sales-tender-cash")).toHaveTextContent(/0/);
  });

  // 15. Manual refresh action
  it("15. Clicking modal refresh button triggers onRefresh handler", () => {
    const handleRefresh = vi.fn();
    render(
      <DailySalesModal
        isOpen={true}
        onClose={vi.fn()}
        report={mockDay1Report}
        isLoading={false}
        isError={false}
        onRefresh={handleRefresh}
      />
    );

    const refreshBtn = screen.getByTestId("daily-sales-refresh-button");
    fireEvent.click(refreshBtn);
    expect(handleRefresh).toHaveBeenCalledTimes(1);
  });
});
