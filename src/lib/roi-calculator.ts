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
    proposals_per_month = 0,
    avg_deal_size = 0,
    close_rate = 0,
    time_to_cash_days = 0,
  } = prospect;

  const hasNumbers = proposals_per_month != null && avg_deal_size != null && close_rate != null && time_to_cash_days != null
    && proposals_per_month > 0 && avg_deal_size > 0;

  if (!hasNumbers) {
    return {
      current_monthly_revenue: 0,
      current_deals_closed: 0,
      elystra_close_rate: 0,
      elystra_monthly_revenue: 0,
      elystra_deals_closed: 0,
      extra_deals_per_month: RECOVERED_DEALS_PER_MONTH,
      monthly_revenue_gap: 0,
      annual_revenue_gap: 0,
      daily_leak: 0,
      weekly_leak: 0,
      time_to_cash_saved_days: 0,
      elystra_time_to_cash: ELYSTRA_TIME_TO_CASH_DAYS,
    };
  }

  const currentCloseDecimal = (close_rate ?? 0) / 100;
  const currentDeals = (proposals_per_month ?? 0) * currentCloseDecimal;
  const currentMonthlyRevenue = currentDeals * (avg_deal_size ?? 0);

  const extraDeals = RECOVERED_DEALS_PER_MONTH;
  const monthlyGap = extraDeals * (avg_deal_size ?? 0);
  const annualGap = monthlyGap * 12;
  const dailyLeak = monthlyGap / 30;
  const weeklyLeak = monthlyGap / 4.3;

  const elystraDeals = currentDeals + extraDeals;
  const elystraMonthlyRevenue = currentMonthlyRevenue + monthlyGap;
  const elystraCloseRate = (proposals_per_month ?? 0) > 0
    ? (elystraDeals / (proposals_per_month ?? 1)) * 100
    : (close_rate ?? 0);

  const timeSaved = Math.max((time_to_cash_days ?? 0) - ELYSTRA_TIME_TO_CASH_DAYS, 0);

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
