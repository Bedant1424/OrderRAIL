/**
 * Sequential Bill Number Generator
 * Ensures sequential, unique bill numbers per cafe.
 */
export class BillNumberGenerator {
  private static sequenceMap: Map<string, number> = new Map();

  /**
   * Generates the next sequential bill number in memory for test / fallback modes.
   */
  public static getNextBillNumber(cafeId: string, currentMaxFromDb?: number): number {
    const key = cafeId.trim().toLowerCase();
    const existing = this.sequenceMap.get(key) || 0;

    let nextNumber = existing + 1;
    if (currentMaxFromDb !== undefined && currentMaxFromDb >= nextNumber) {
      nextNumber = currentMaxFromDb + 1;
    }

    this.sequenceMap.set(key, nextNumber);
    return nextNumber;
  }

  public static resetSequenceForTesting(cafeId?: string): void {
    if (cafeId) {
      this.sequenceMap.delete(cafeId.trim().toLowerCase());
    } else {
      this.sequenceMap.clear();
    }
  }
}
