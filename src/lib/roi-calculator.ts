/**
 * ROI Calculator
 * Anchored to "+1–2 deals/month" — same frame across ALL emails.
 * No modeled close-rate. Pure arithmetic from their numbers.
 */

import type { Prospect, ROICalculation } from '@/types/prospect';

const ELYSTRA_TIME_TO_CASH_DAYS = 2;

// Pessimistic: 1.5 recovered deals/month (midpoint of "1–2" in all copy)
const RECOVERED_DEALS_PER_MONTH = 1.5;

export function calculateROI(prospect: Prospect): ROICalculation {
  const {
    proposals_per_month,
    avg_deal_size,
    close_rate,
    time_to_cash_days,
  } = prospect;

  const currentCloseDecimal = close_rate / 100;
  const currentDeals = proposals_per_month * currentCloseDecimal;
  const currentMonthlyRevenue = currentDeals * avg_deal_size;

  const extraDeals = RECOVERED_DEALS_PER_MONTH;
  const monthlyGap = extraDeals * avg_deal_size;
  const annualGap = monthlyGap * 12;
  const dailyLeak = monthlyGap / 30;
  const weeklyLeak = monthlyGap / 4.3;

  const elystraDeals = currentDeals + extraDeals;
  const elystraMonthlyRevenue = currentMonthlyRevenue + monthlyGap;
  const elystraCloseRate = proposals_per_month > 0
    ? (elystraDeals / proposals_per_month) * 100
    : close_rate;

  const timeSaved = Math.max(time_to_cash_days - ELYSTRA_TIME_TO_CASH_DAYS, 0);

  return {
    current_monthly_revenue: Math.round(currentMonthlyRevenue),
    current_deals_closed: Math.round(currentDeals * 10) / 10,
    elystra_close_rate: Math.round(elystraCloseRate * 10) / 10,
    elystra_monthly_revenue: Math.round(elystraMonthlyRevenue),
    elystra_deals_closed: Math.round(elystraDeals * 10) / 10,
    extra_deals_per_month: RECOVERED_DEALS_PER_MONTH,
    monthly_revenue_gap: Math.round(monthlyGap),
    annual_revenue_gap: Math.round(annualGap),
    daily_leak: Math.round(dailyLeak),
    weekly_leak: Math.round(weeklyLeak),
    time_to_cash_saved_days: timeSaved,
    elystra_time_to_cash: ELYSTRA_TIME_TO_CASH_DAYS,
  };
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}
