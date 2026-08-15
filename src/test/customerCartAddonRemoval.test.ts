import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import React, { type ReactNode } from 'react';
import { CartProvider, useCart, type CartLine } from '@/lib/cart';

const mockBurger = {
  id: 'spicy-salsa-burger',
  name: 'Spicy Salsa Burger',
  price_cents: 8900,
  image_url: 'spicy-salsa-burger.jpg',
};

const wrapper = ({ children }: { children: ReactNode }) => (
  React.createElement(CartProvider, { tableId: 'test-table-1' }, children)
);

describe('Customer Cart Add-on Line Identity & Removal Suite', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('1. Removing plain burger leaves cheese-slice burger untouched', () => {
    const { result } = renderHook(() => useCart(), { wrapper });

    act(() => {
      result.current.add(mockBurger, [], '');
      result.current.add(mockBurger, ['cheese-slice'], '+ Cheese Slice (+₹20)', 10900);
    });

    expect(result.current.lines.length).toBe(2);
    expect(result.current.lines[0].lineId).toBe('spicy-salsa-burger');
    expect(result.current.lines[1].lineId).toBe('spicy-salsa-burger:cheese-slice');

    act(() => {
      result.current.remove('spicy-salsa-burger');
    });

    expect(result.current.lines.length).toBe(1);
    expect(result.current.lines[0].lineId).toBe('spicy-salsa-burger:cheese-slice');
    expect(result.current.lines[0].qty).toBe(1);
  });

  it('2. Removing cheese-slice burger leaves plain burger untouched', () => {
    const { result } = renderHook(() => useCart(), { wrapper });

    act(() => {
      result.current.add(mockBurger, [], '');
      result.current.add(mockBurger, ['cheese-slice'], '+ Cheese Slice (+₹20)', 10900);
    });

    expect(result.current.lines.length).toBe(2);

    act(() => {
      result.current.remove('spicy-salsa-burger:cheese-slice');
    });

    expect(result.current.lines.length).toBe(1);
    expect(result.current.lines[0].lineId).toBe('spicy-salsa-burger');
    expect(result.current.lines[0].qty).toBe(1);
  });

  it('3. Two plain burgers decrement quantity to 1 then remove line completely', () => {
    const { result } = renderHook(() => useCart(), { wrapper });

    act(() => {
      result.current.add(mockBurger, [], '');
      result.current.add(mockBurger, [], '');
    });

    expect(result.current.lines.length).toBe(1);
    expect(result.current.lines[0].lineId).toBe('spicy-salsa-burger');
    expect(result.current.lines[0].qty).toBe(2);

    act(() => {
      result.current.setQty('spicy-salsa-burger', 1);
    });

    expect(result.current.lines.length).toBe(1);
    expect(result.current.lines[0].qty).toBe(1);

    act(() => {
      result.current.remove('spicy-salsa-burger');
    });

    expect(result.current.lines.length).toBe(0);
  });

  it('4. Two Cheese Slice burgers decrement quantity to 1 then remove line completely', () => {
    const { result } = renderHook(() => useCart(), { wrapper });

    act(() => {
      result.current.add(mockBurger, ['cheese-slice'], '+ Cheese Slice (+₹20)', 10900);
      result.current.add(mockBurger, ['cheese-slice'], '+ Cheese Slice (+₹20)', 10900);
    });

    expect(result.current.lines.length).toBe(1);
    expect(result.current.lines[0].lineId).toBe('spicy-salsa-burger:cheese-slice');
    expect(result.current.lines[0].qty).toBe(2);

    act(() => {
      result.current.setQty('spicy-salsa-burger:cheese-slice', 1);
    });

    expect(result.current.lines.length).toBe(1);
    expect(result.current.lines[0].qty).toBe(1);

    act(() => {
      result.current.remove('spicy-salsa-burger:cheese-slice');
    });

    expect(result.current.lines.length).toBe(0);
  });

  it('5. Three variants (Plain, Cheese Slice, Cheese Injector) are isolated on individual removal', () => {
    const { result } = renderHook(() => useCart(), { wrapper });

    act(() => {
      result.current.add(mockBurger, [], '');
      result.current.add(mockBurger, ['cheese-slice'], '+ Cheese Slice (+₹20)', 10900);
      result.current.add(mockBurger, ['cheese-injector'], '+ Cheese Injector (+₹30)', 11900);
    });

    expect(result.current.lines.length).toBe(3);
    expect(result.current.lines.map((l) => l.lineId)).toEqual([
      'spicy-salsa-burger',
      'spicy-salsa-burger:cheese-slice',
      'spicy-salsa-burger:cheese-injector',
    ]);

    // Remove middle variant (Cheese Slice)
    act(() => {
      result.current.remove('spicy-salsa-burger:cheese-slice');
    });

    expect(result.current.lines.length).toBe(2);
    expect(result.current.lines.map((l) => l.lineId)).toEqual([
      'spicy-salsa-burger',
      'spicy-salsa-burger:cheese-injector',
    ]);

    // Remove plain variant
    act(() => {
      result.current.remove('spicy-salsa-burger');
    });

    expect(result.current.lines.length).toBe(1);
    expect(result.current.lines[0].lineId).toBe('spicy-salsa-burger:cheese-injector');

    // Remove last remaining variant
    act(() => {
      result.current.remove('spicy-salsa-burger:cheese-injector');
    });

    expect(result.current.lines.length).toBe(0);
  });

  it('6. Identical add-on combinations share one line and sort add-on keys correctly', () => {
    const { result } = renderHook(() => useCart(), { wrapper });

    act(() => {
      result.current.add(mockBurger, ['cheese-injector', 'cheese-slice'], '+ Cheese Injector, Cheese Slice', 13900);
      result.current.add(mockBurger, ['cheese-slice', 'cheese-injector'], '+ Cheese Slice, Cheese Injector', 13900);
    });

    expect(result.current.lines.length).toBe(1);
    expect(result.current.lines[0].lineId).toBe('spicy-salsa-burger:cheese-injector,cheese-slice');
    expect(result.current.lines[0].qty).toBe(2);
  });
});
