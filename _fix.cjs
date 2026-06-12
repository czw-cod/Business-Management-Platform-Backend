require('dotenv').config();
const {Pool}=require('pg');
const p=new Pool({host:process.env.DB_HOST,port:process.env.DB_PORT||5432,user:process.env.DB_USER,password:process.env.DB_PASSWORD,database:process.env.DB_NAME,ssl:{rejectUnauthorized:false},options:'-c search_path=emp_db'});
(async()=>{
  let r = await p.query("SELECT column_name,data_type FROM information_schema.columns WHERE table_schema='emp_db' AND table_name='role'");
  console.log(JSON.stringify(r.rows));
  r = await p.query("SELECT column_name,data_type FROM information_schema.columns WHERE table_schema='emp_db' AND table_name='employee'");
  console.log(JSON.stringify(r.rows));
  await p.end();
})();
