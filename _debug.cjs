require("dotenv").config();
const {Pool} = require("pg");
const p = new Pool({host:process.env.DB_HOST,port:process.env.DB_PORT||5432,user:process.env.DB_USER,password:process.env.DB_PASSWORD,database:process.env.DB_NAME,ssl:{rejectUnauthorized:false},options:"-c search_path=shop_admin"});
(async () => {
  try {
    let r = await p.query("SELECT id,name FROM attr WHERE category_id=1");
    console.log("简单查询 attr:", r.rows.length + " 条");
  } catch(e) { console.error("attr查询失败:", e.message); }
  try {
    let r = await p.query("SELECT column_name,data_type FROM information_schema.columns WHERE table_schema='shop_admin' AND table_name='attr'");
    console.log("attr结构:", JSON.stringify(r.rows));
  } catch(e) { console.error("结构查询失败:", e.message); }
  try {
    // 测试原生的 query 替换逻辑
    const q = "INSERT INTO attr (category_id, name) VALUES ($1, $2) RETURNING id";
    let r = await p.query(q, [1, "测试属性"]);
    console.log("插入成功, id=" + r.rows[0].id);
  } catch(e) { console.error("插入失败:", e.message); }
  await p.end();
})();
