import { describe, expect, it } from "vitest";
import { runSqlFull, type SqlDb, type SqlValue } from "./engine";

const DB: SqlDb = {
  tables: [
    { name: "customers", columns: ["id", "name", "city", "joined"], rows: [[1, "Asha", "Pune", "2025-01-10"], [2, "Bilal", "Delhi", "2025-02-05"], [3, "Chitra", "Pune", "2025-03-20"], [4, "Dev", "Mumbai", "2025-03-25"], [5, "Esha", null, "2025-04-02"]] },
    { name: "orders", columns: ["id", "customer_id", "amount", "status", "ordered"], rows: [[10, 1, 500, "paid", "2025-03-01"], [11, 1, 300, "paid", "2025-03-15"], [12, 2, 700, "paid", "2025-03-02"], [13, 3, 200, "refunded", "2025-03-10"], [14, 3, 450, "paid", "2025-04-01"], [15, 9, 100, "paid", "2025-04-05"], [16, 2, 250, "paid", "2025-04-09"]] },
  ],
};
const q = (sql: string): SqlValue[][] => { const r = runSqlFull(DB, sql); if (!r.ok) throw new Error(r.error); return r.rows; };
const cols = (sql: string): string[] => { const r = runSqlFull(DB, sql); if (!r.ok) throw new Error(r.error); return r.columns; };
const err = (sql: string): string => { const r = runSqlFull(DB, sql); if (r.ok) throw new Error("expected an error"); return r.error + " " + (r.hint ?? ""); };

describe("sql: selecting and filtering", () => {
  it("SELECT, WHERE, ORDER BY, LIMIT, OFFSET and aliases", () => {
    expect(q("SELECT name FROM customers WHERE city = 'Pune' ORDER BY name DESC")).toEqual([["Chitra"], ["Asha"]]);
    expect(q("SELECT name, amount * 2 AS double FROM customers c JOIN orders o ON o.customer_id = c.id WHERE o.id = 10")).toEqual([["Asha", 1000]]);
    expect(q("SELECT id FROM orders ORDER BY amount DESC LIMIT 2")).toEqual([[12], [10]]);
    expect(q("SELECT id FROM orders ORDER BY id LIMIT 2 OFFSET 2")).toEqual([[12], [13]]);
    expect(cols("SELECT name AS who, UPPER(city) FROM customers")).toEqual(["who", "UPPER(city)"]);
    expect(q("select * from customers where id = 1")).toEqual([[1, "Asha", "Pune", "2025-01-10"]]);
    expect(cols("SELECT * FROM customers")).toEqual(["id", "name", "city", "joined"]);
  });
  it("DISTINCT, IN, BETWEEN, LIKE and combined conditions", () => {
    expect(q("SELECT DISTINCT city FROM customers WHERE city IS NOT NULL ORDER BY city")).toEqual([["Delhi"], ["Mumbai"], ["Pune"]]);
    expect(q("SELECT id FROM orders WHERE amount BETWEEN 250 AND 500 ORDER BY id")).toEqual([[10], [11], [14], [16]]);
    expect(q("SELECT name FROM customers WHERE name LIKE '%a' ORDER BY id")).toEqual([["Asha"], ["Chitra"], ["Esha"]]);
    expect(q("SELECT name FROM customers WHERE name LIKE '_ev'")).toEqual([["Dev"]]);
    expect(q("SELECT id FROM orders WHERE status IN ('refunded') OR amount > 600 ORDER BY id")).toEqual([[12], [13]]);
    expect(q("SELECT id FROM orders WHERE NOT (status = 'paid') AND amount < 300")).toEqual([[13]]);
  });
  it("NULL behaves the SQL way", () => {
    expect(q("SELECT name FROM customers WHERE city = NULL")).toEqual([]);
    expect(q("SELECT name FROM customers WHERE city IS NULL")).toEqual([["Esha"]]);
    expect(q("SELECT name FROM customers WHERE city <> 'Pune' ORDER BY id")).toEqual([["Bilal"], ["Dev"]]); // Esha (NULL) is not included
    expect(q("SELECT COALESCE(city, 'unknown') FROM customers WHERE id = 5")).toEqual([["unknown"]]);
    expect(q("SELECT NULLIF(city, 'Pune') FROM customers WHERE id = 1")).toEqual([[null]]);
  });
  it("arithmetic, text, dates and CASE", () => {
    expect(q("SELECT amount / 4, amount % 7 FROM orders WHERE id = 10")).toEqual([[125, 3]]);
    expect(q("SELECT name || '-' || city FROM customers WHERE id = 1")).toEqual([["Asha-Pune"]]);
    expect(q("SELECT LENGTH(name), SUBSTR(name, 2, 3), UPPER(name) FROM customers WHERE id = 3")).toEqual([[6, "hit", "CHITRA"]]);
    expect(q("SELECT YEAR(joined), MONTH(joined), DAY(joined) FROM customers WHERE id = 3")).toEqual([[2025, 3, 20]]);
    expect(q("SELECT DATEDIFF('2025-03-20', '2025-03-01')")).toEqual([[19]]);
    expect(q("SELECT ROUND(10 / 3, 2), ABS(-4), FLOOR(2.7), CEIL(2.1)")).toEqual([[3.33, 4, 2, 3]]);
    expect(q("SELECT CASE WHEN amount >= 500 THEN 'big' WHEN amount >= 300 THEN 'mid' ELSE 'small' END FROM orders ORDER BY id LIMIT 4")).toEqual([["big"], ["mid"], ["big"], ["small"]]);
    expect(q("SELECT CASE status WHEN 'paid' THEN 1 ELSE 0 END FROM orders WHERE id IN (10, 13) ORDER BY id")).toEqual([[1], [0]]);
    expect(q("SELECT CAST('42' AS INTEGER) + 1")).toEqual([[43]]);
  });
});

describe("sql: joins", () => {
  it("INNER, LEFT, RIGHT, FULL, CROSS and USING", () => {
    expect(q("SELECT c.name, o.amount FROM customers c JOIN orders o ON o.customer_id = c.id WHERE o.status = 'refunded'")).toEqual([["Chitra", 200]]);
    expect(q("SELECT c.name, o.id FROM customers c LEFT JOIN orders o ON o.customer_id = c.id WHERE o.id IS NULL ORDER BY c.id")).toEqual([["Dev", null], ["Esha", null]]);
    expect(q("SELECT c.name, o.id FROM customers c RIGHT JOIN orders o ON o.customer_id = c.id WHERE c.id IS NULL")).toEqual([[null, 15]]);
    expect(q("SELECT COUNT(*) FROM customers c FULL JOIN orders o ON o.customer_id = c.id")).toEqual([[9]]); // 7 order rows (one with no customer) + 2 customers with no orders
    expect(q("SELECT COUNT(*) FROM customers CROSS JOIN orders")).toEqual([[35]]);
    expect(q("SELECT COUNT(*) FROM customers, orders")).toEqual([[35]]);
    const U: SqlDb = { tables: [{ name: "a", columns: ["id", "x"], rows: [[1, "p"], [2, "q"]] }, { name: "b", columns: ["id", "y"], rows: [[2, "z"]] }] };
    const r = runSqlFull(U, "SELECT a.x, b.y FROM a JOIN b USING (id)");
    expect(r.ok && r.rows).toEqual([["q", "z"]]);
  });
  it("an unqualified name that belongs to two tables is explained", () => {
    expect(err("SELECT id FROM customers c JOIN orders o ON o.customer_id = c.id")).toMatch(/more than one table/);
  });
});

describe("sql: grouping", () => {
  it("GROUP BY, HAVING and the aggregates", () => {
    expect(q("SELECT status, COUNT(*), SUM(amount), AVG(amount), MIN(amount), MAX(amount) FROM orders GROUP BY status ORDER BY status")).toEqual([["paid", 6, 2300, 2300 / 6, 100, 700].map((v, i) => (i === 3 ? parseFloat((2300 / 6).toPrecision(12)) : v)), ["refunded", 1, 200, 200, 200, 200]]);
    expect(q("SELECT customer_id, SUM(amount) AS total FROM orders GROUP BY customer_id HAVING SUM(amount) > 500 ORDER BY total DESC")).toEqual([[2, 950], [1, 800], [3, 650]]);
    expect(q("SELECT COUNT(DISTINCT customer_id) FROM orders")).toEqual([[4]]);
    expect(q("SELECT COUNT(city) FROM customers")).toEqual([[4]]);
    expect(q("SELECT COUNT(*) FROM orders WHERE amount > 10000")).toEqual([[0]]);
    expect(q("SELECT SUM(amount) FROM orders WHERE amount > 10000")).toEqual([[null]]);
    expect(q("SELECT city, COUNT(*) FROM customers GROUP BY city ORDER BY COUNT(*) DESC, city LIMIT 1")).toEqual([["Pune", 2]]);
  });
  it("tells you when a column is neither grouped nor aggregated, and when WHERE holds an aggregate", () => {
    expect(err("SELECT city, name, COUNT(*) FROM customers GROUP BY city")).toMatch(/must appear in GROUP BY/);
    expect(err("SELECT city FROM customers WHERE COUNT(*) > 1")).toMatch(/cannot be used in WHERE/);
  });
});

describe("sql: subqueries, CTEs and sets", () => {
  it("scalar, IN and correlated EXISTS subqueries", () => {
    expect(q("SELECT id FROM orders WHERE amount > (SELECT AVG(amount) FROM orders) ORDER BY id")).toEqual([[10], [12], [14]]);
    expect(q("SELECT name FROM customers WHERE id IN (SELECT customer_id FROM orders WHERE status = 'refunded')")).toEqual([["Chitra"]]);
    expect(q("SELECT name FROM customers c WHERE NOT EXISTS (SELECT 1 FROM orders o WHERE o.customer_id = c.id) ORDER BY name")).toEqual([["Dev"], ["Esha"]]);
    expect(q("SELECT name FROM customers WHERE id NOT IN (SELECT customer_id FROM orders)")).toEqual([["Dev"], ["Esha"]]);
  });
  it("subqueries in FROM, CTEs and UNION", () => {
    expect(q("SELECT t.c FROM (SELECT customer_id AS c, SUM(amount) AS s FROM orders GROUP BY customer_id) t WHERE t.s > 900")).toEqual([[2]]);
    expect(q("WITH totals AS (SELECT customer_id, SUM(amount) AS total FROM orders GROUP BY customer_id) SELECT c.name, t.total FROM customers c JOIN totals t ON t.customer_id = c.id ORDER BY t.total DESC LIMIT 1")).toEqual([["Bilal", 950]]);
    expect(q("WITH a AS (SELECT 1 AS n), b AS (SELECT n + 1 AS n FROM a) SELECT n FROM b")).toEqual([[2]]);
    expect(q("SELECT city FROM customers WHERE id = 1 UNION SELECT city FROM customers WHERE id = 3 ORDER BY 1")).toEqual([["Pune"]]);
    expect(q("SELECT city FROM customers WHERE id IN (1, 3) UNION ALL SELECT 'x'")).toEqual([["Pune"], ["Pune"], ["x"]]);
  });
});

describe("sql: window functions", () => {
  it("ranking: ROW_NUMBER, RANK, DENSE_RANK, NTILE", () => {
    const r = q("SELECT id, ROW_NUMBER() OVER (ORDER BY amount DESC) AS rn, RANK() OVER (ORDER BY status) AS rk, DENSE_RANK() OVER (ORDER BY status) AS dr FROM orders ORDER BY id");
    expect(r.map((x) => x[1])).toEqual([2, 4, 1, 6, 3, 7, 5]);
    expect(r.map((x) => x[2])).toEqual([1, 1, 1, 7, 1, 1, 1]);
    expect(r.map((x) => x[3])).toEqual([1, 1, 1, 2, 1, 1, 1]);
    expect(q("SELECT id, NTILE(2) OVER (ORDER BY id) FROM orders ORDER BY id").map((x) => x[1])).toEqual([1, 1, 1, 1, 2, 2, 2]);
  });
  it("partitions, running totals and moving averages", () => {
    expect(q("SELECT id, SUM(amount) OVER (PARTITION BY customer_id ORDER BY ordered) FROM orders ORDER BY id").map((x) => x[1])).toEqual([500, 800, 700, 200, 650, 100, 950]);
    expect(q("SELECT id, SUM(amount) OVER (PARTITION BY customer_id) FROM orders ORDER BY id").map((x) => x[1])).toEqual([800, 800, 950, 650, 650, 100, 950]);
    expect(q("SELECT id, AVG(amount) OVER (ORDER BY id ROWS BETWEEN 1 PRECEDING AND CURRENT ROW) FROM orders ORDER BY id").map((x) => x[1])).toEqual([500, 400, 500, 450, 325, 275, 175]);
    expect(q("SELECT id, COUNT(*) OVER () FROM orders WHERE id < 12 ORDER BY id").map((x) => x[1])).toEqual([2, 2]);
  });
  it("LAG, LEAD, FIRST_VALUE and a share of total", () => {
    expect(q("SELECT id, LAG(amount) OVER (ORDER BY id), LEAD(amount, 1, 0) OVER (ORDER BY id) FROM orders ORDER BY id LIMIT 2")).toEqual([[10, null, 300], [11, 500, 700]]);
    expect(q("SELECT id, amount - LAG(amount) OVER (PARTITION BY customer_id ORDER BY ordered) FROM orders WHERE customer_id = 1 ORDER BY id").map((x) => x[1])).toEqual([null, -200]);
    expect(q("SELECT id, FIRST_VALUE(amount) OVER (PARTITION BY customer_id ORDER BY ordered) FROM orders ORDER BY id").map((x) => x[1])).toEqual([500, 500, 700, 200, 200, 100, 700]);
    expect(q("SELECT id, ROUND(100.0 * amount / SUM(amount) OVER (), 1) FROM orders WHERE id <= 11 ORDER BY id").map((x) => x[1])).toEqual([62.5, 37.5]);
    expect(q("SELECT customer_id, SUM(amount) AS s, RANK() OVER (ORDER BY SUM(amount) DESC) FROM orders GROUP BY customer_id ORDER BY 3").map((x) => [x[0], x[2]])).toEqual([[2, 1], [1, 2], [3, 3], [9, 4]].map((x) => x));
  });
});

describe("sql: friendly errors and safety", () => {
  it("explains unknown tables and columns", () => {
    expect(err("SELECT * FROM customer")).toMatch(/no table called "customer"[\s\S]*customers/);
    expect(err("SELECT nme FROM customers")).toMatch(/no column called "nme"[\s\S]*name/);
  });
  it("explains common syntax slips", () => {
    expect(err("SELECT name FORM customers")).toMatch(/FROM/);
    expect(err("SELECT name FROM customers WHERE")).toMatch(/Expected a value/);
    expect(err("SELECT name, FROM customers")).toBeTruthy();
    expect(err("SELECT 'abc FROM customers")).toMatch(/never closed/);
    expect(err("")).toMatch(/Type a query/);
    expect(err("SELECT name FROM customers JOIN orders")).toMatch(/needs ON or USING/);
    expect(err("SELECT name FROM customers WHERE city IS Pune")).toMatch(/NULL/);
  });
  it("only reads: statements that change data do not exist here", () => {
    for (const s of ["DELETE FROM customers", "DROP TABLE customers", "UPDATE customers SET name = 'x'", "INSERT INTO customers VALUES (9)", "CREATE TABLE t (a int)"]) expect(err(s)).toMatch(/must start with SELECT/);
  });
  it("a runaway query is stopped", () => {
    const big: SqlDb = { tables: [{ name: "t", columns: ["x"], rows: Array.from({ length: 400 }, (_, i) => [i]) }] };
    const r = runSqlFull(big, "SELECT COUNT(*) FROM t a, t b, t c, t d");
    expect(r.ok).toBe(false);
  });
  it("results are rounded so 0.1 + 0.2 reads 0.3", () => {
    expect(q("SELECT 0.1 + 0.2")).toEqual([[0.3]]);
  });
});

describe("sql: extra functions", () => {
  it("LEFT, RIGHT and DATE_TRUNC", () => {
    expect(q("SELECT LEFT(name, 2), RIGHT(name, 2), DATE_TRUNC('month', joined) FROM customers WHERE id = 3")).toEqual([["Ch", "ra", "2025-03-01"]]);
    expect(q("SELECT DATE_TRUNC('quarter', '2025-05-17'), DATE_TRUNC('year', '2025-05-17')")).toEqual([["2025-04-01", "2025-01-01"]]);
  });
});

describe("sql: INTERSECT and EXCEPT", () => {
  it("keep or remove rows that appear in both queries (each result row once)", () => {
    expect(q("SELECT customer_id FROM orders WHERE amount > 300 INTERSECT SELECT customer_id FROM orders WHERE status = 'refunded'")).toEqual([[3]]);
    expect(q("SELECT customer_id FROM orders INTERSECT SELECT id FROM customers WHERE city = 'Pune' ORDER BY 1")).toEqual([[1], [3]]);
    expect(q("SELECT id FROM customers EXCEPT SELECT customer_id FROM orders ORDER BY 1")).toEqual([[4], [5]]);
  });
});

describe("sql: GROUP BY a position or an alias", () => {
  it("works like MySQL and PostgreSQL", () => {
    expect(q("SELECT city, COUNT(*) FROM customers WHERE city IS NOT NULL GROUP BY 1 ORDER BY 1")).toEqual([["Delhi", 1], ["Mumbai", 1], ["Pune", 2]]);
    expect(q("SELECT SUBSTR(joined, 1, 7) AS month, COUNT(*) AS n FROM customers GROUP BY month ORDER BY 1")).toEqual([["2025-01", 1], ["2025-02", 1], ["2025-03", 2], ["2025-04", 1]]);
    expect(q("SELECT status, FLOOR(amount / 100) AS h, COUNT(*) FROM orders GROUP BY 1, 2 ORDER BY 1, 2").length).toBeGreaterThan(2);
    expect(err("SELECT city, COUNT(*) FROM customers GROUP BY 3")).toMatch(/only 2/);
    expect(err("SELECT city, COUNT(*) FROM customers GROUP BY 2")).toMatch(/aggregate/);
  });
});
