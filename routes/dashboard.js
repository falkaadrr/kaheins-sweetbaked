import express from "express";
import { supabase } from "../config/supabase.js";
import { requireAuth } from "../middleware/auth.js";
import { wrap } from "../lib/helpers.js";

const router = express.Router();

// Status yang dihitung sebagai omzet (sama seperti logika di halaman Pesanan)
const REVENUE_STATUSES = ["paid", "processing", "shipped", "done"];

// GET /api/dashboard/summary (admin)
router.get("/summary", requireAuth, wrap(async (_req, res) => {
  const { data: orders, error } = await supabase
    .from("orders")
    .select("id, order_no, customer_name, total, status, source, created_at, items:order_items(product_name, qty, line_total)")
    .order("created_at", { ascending: false })
    .limit(2000);
  if (error) throw error;

  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const isRev = (o) => REVENUE_STATUSES.includes(o.status);

  let omzetTotal = 0, omzetMonth = 0, omzetToday = 0;
  let ordersMonth = 0, ordersToday = 0, revOrders = 0;
  let omzetOnline = 0, omzetPos = 0;
  const statusCount = {};
  const bestMap = {};
  const dayMap = {};

  // Siapkan slot 14 hari terakhir
  const days = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(startToday); d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    days.push(key); dayMap[key] = 0;
  }

  for (const o of orders) {
    statusCount[o.status] = (statusCount[o.status] || 0) + 1;
    if (!isRev(o)) continue;
    const created = new Date(o.created_at);
    omzetTotal += o.total; revOrders++;
    if (o.source === "pos") omzetPos += o.total; else omzetOnline += o.total;
    if (created >= startMonth) { omzetMonth += o.total; ordersMonth++; }
    if (created >= startToday) { omzetToday += o.total; ordersToday++; }
    const dk = created.toISOString().slice(0, 10);
    if (dk in dayMap) dayMap[dk] += o.total;
    for (const it of (o.items || [])) {
      const b = bestMap[it.product_name] || (bestMap[it.product_name] = { qty: 0, revenue: 0 });
      b.qty += it.qty; b.revenue += it.line_total;
    }
  }

  const bestSellers = Object.entries(bestMap)
    .map(([name, v]) => ({ name, qty: v.qty, revenue: v.revenue }))
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 5);

  const trend = days.map((key) => ({ date: key, revenue: dayMap[key] }));

  const recent = orders.slice(0, 8).map((o) => ({
    order_no: o.order_no, customer_name: o.customer_name, total: o.total,
    status: o.status, source: o.source, created_at: o.created_at,
  }));

  res.json({
    omzetTotal, omzetMonth, omzetToday,
    ordersTotal: orders.length, ordersMonth, ordersToday,
    revOrders, avgOrder: revOrders ? Math.round(omzetTotal / revOrders) : 0,
    omzetOnline, omzetPos,
    statusCount, bestSellers, trend, recent,
  });
}));

export default router;
