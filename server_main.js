const express = require("express");
const cors = require("cors");
const cookieParser = require('cookie-parser')
const app = express();
// Render自动分配端口，本地默认8889
const port = process.env.PORT || 8889;

// 中间件 - 中文乱码处理
app.use((req, res, next) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  next();
});
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "10mb" }));
app.use(cookieParser())

app.get('/healthz', (req, res) => {
  res.sendStatus(200);
});
// ========== 环境变量 + pg 驱动 ==========

const { Pool } = require('pg');

// ========== 双连接池：shop_admin / emp_db 模式 ==========
const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || "postgres",
  ssl: { rejectUnauthorized: false },
  max: 20,
  options: '-c search_path=shop_admin'
});

const emppool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || "postgres",
  ssl: { rejectUnauthorized: false },
  max: 20,
  options: '-c search_path=emp_db'
});

// 数据库连接检测
pool.connect()
  .then((conn) => {
    console.log("✅ PostgreSQL(shop_admin/商品库) 连接成功");
    conn.release();
  })
  .catch((err) => {
    console.error("❌ 商品库连接失败：", err.message);
    process.exit(1);
  });

emppool.connect()
  .then((conn) => {
    console.log("✅ PostgreSQL(emp_db/员工库) 连接成功");
    conn.release();
  })
  .catch((err) => {
    console.error("❌ 员工库连接失败：", err.message);
    process.exit(1);
  });

// 模拟登录用户
const user = {
  username: 'czw',
  password: '111111',
  token: 'czw-token-666',
  sessionId: null
}

// ====================== 登录接口（无SQL，无需修改） ======================
app.post('/user/login', (req, res) => {
  const token = req.headers.token
  if (token && token === user.token) {
    const clientSessionId = req.cookies.SESSION_ID
    if (!clientSessionId || clientSessionId !== user.sessionId) {
      return res.json({ code: 401, message: '会话异常，请重新登录' })
    }
    return res.json({
      code: 200,
      message: 'token有效，自动登录成功',
      data: { token: user.token, username: user.username }
    })
  }

  const { username, password } = req.body
  if (username === user.username && password === user.password) {
    const newSessionId = 'sess-' + Date.now() + '-' + Math.random().toString(36).slice(2)
    user.sessionId = newSessionId
    res.cookie('SESSION_ID', newSessionId, {
      httpOnly: true,
      maxAge: 2 * 60 * 60 * 1000
    })
    return res.json({
      code: 200,
      message: '登录成功',
      data: { token: user.token, username: user.username }
    })
  } else {
    return res.json({ code: 500, message: '账号或密码错误', data: null })
  }
})

app.get('/user/info', (req, res) => {
  const token = req.headers.token
  const clientSessionId = req.cookies.SESSION_ID
  if (!token || token !== user.token) {
    return res.json({ code: 401, message: 'token无效' })
  }
  if (!clientSessionId || clientSessionId !== user.sessionId) {
    return res.json({ code: 401, message: '会话异常，请重新登录' })
  }
  res.json({
    code: 200,
    message: 'token有效',
    data: { username: user.username }
  })
})

// ==================== 1. 品牌CRUD（全替换为PG占位符） ====================
// 分页查询品牌
app.get("/admin/product/baseTrademark/:page/:limit", async (req, res) => {
  try {
    const { page, limit } = req.params;
    const offset = (page - 1) * Number(limit);

    const recordRes = await pool.query(
      "SELECT id, tm_name, logo_url FROM base_trademark ORDER BY id LIMIT $1 OFFSET $2",
      [Number(limit), offset]
    );
    const records = recordRes.rows;

    const totalRes = await pool.query("SELECT COUNT(*) AS total FROM base_trademark");
    const total = totalRes.rows[0].total;

    res.json({
      code: 200,
      data: {
        records,
        total,
        current: Number(page),
        size: Number(limit),
      },
    });
  } catch (e) {
    console.error("查询品牌失败：", e);
    res.json({ code: 500, message: "服务器错误" });
  }
});

// 添加品牌
app.post("/admin/product/baseTrademark/save", async (req, res) => {
  try {
    const { tm_name, logo_url } = req.body;
    if (!tm_name || !logo_url) {
      return res.json({ code: 400, message: "参数不完整" });
    }
    await pool.query(
      "INSERT INTO base_trademark (tm_name, logo_url) VALUES ($1, $2)",
      [tm_name, logo_url]
    );
    res.json({ code: 200 });
  } catch (e) {
    console.error("添加品牌失败：", e);
    res.json({ code: 500, message: "服务器错误" });
  }
});

// 修改品牌
app.post("/admin/product/baseTrademark/update", async (req, res) => {
  try {
    console.log('update body:', JSON.stringify(req.body));
    const { id, tm_name, logo_url } = req.body;
    if (!id || !tm_name || !logo_url) {
      return res.json({ code: 400, message: "参数不完整" });
    }
    await pool.query(
      "UPDATE base_trademark SET tm_name=$1, logo_url=$2 WHERE id=$3",
      [tm_name, logo_url, id]
    );
    res.json({ code: 200 });
  } catch (e) {
    console.error("修改品牌失败：", e);
    res.json({ code: 500, message: "服务器错误" });
  }
});

// 删除品牌
app.post("/admin/product/baseTrademark/remove", async (req, res) => {
  try {
    const { id } = req.body;
    if (!id) {
      return res.json({ code: 400, message: "缺少id" });
    }
    await pool.query("DELETE FROM base_trademark WHERE id=$1", [id]);
    res.json({ code: 200, message: "删除成功" });
  } catch (e) {
    console.error("删除品牌失败：", e);
    res.json({ code: 500, message: "服务器错误" });
  }
});

// ==================== 2. 三级分类 + 属性接口（全替换为PG占位符） ====================
// 获取一级分类（无参数，无需修改）
app.get("/admin/product/category/list/tree", async (req, res) => {
  try {
    const resData = await pool.query(
      "SELECT id, name FROM category WHERE parent_id=0 ORDER BY id"
    );
    res.json({ code: 200, data: resData.rows });
  } catch (e) {
    console.error("获取一级分类失败：", e);
    res.json({ code: 500, message: "服务器错误" });
  }
});

// 获取子分类（二级/三级）
app.get("/admin/product/category/list/:parentId", async (req, res) => {
  try {
    const parentId = Number(req.params.parentId);
    const resData = await pool.query(
      "SELECT id, name FROM category WHERE parent_id=$1 ORDER BY id",
      [parentId]
    );
    res.json({ code: 200, data: resData.rows });
  } catch (e) {
    console.error("获取子分类失败：", e);
    res.json({ code: 500, message: "服务器错误" });
  }
});

// 获取当前三级分类的属性列表
app.get("/admin/product/attr/list/:categoryId", async (req, res) => {
  try {
    const categoryId = Number(req.params.categoryId);
    const attrRes = await pool.query(
      "SELECT id, name FROM attr WHERE category_id=$1 ORDER BY id",
      [categoryId]
    );
    const attrs = attrRes.rows;

    for (let attr of attrs) {
      const valRes = await pool.query(
        "SELECT value FROM attr_value WHERE attr_id=$1 ORDER BY id",
        [attr.id]
      );
      attr.valueList = valRes.rows.map((v) => v.value);
    }
    res.json({ code: 200, data: attrs });
  } catch (e) {
    console.error("获取属性失败：", e);
    res.json({ code: 500, message: "服务器错误" });
  }
});

// 新增属性（事务）
app.post("/admin/product/attr/save", async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { categoryId, attrName, attrValueList } = req.body;

    if (!categoryId || !attrName || !attrValueList || !Array.isArray(attrValueList)) {
      client.release();
      return res.json({ code: 400, message: "参数不完整" });
    }

    const attrRes = await client.query(
      "INSERT INTO attr (category_id, name) VALUES ($1, $2) RETURNING id",
      [Number(categoryId), attrName]
    );
    const attrId = attrRes.rows[0].id;

    const valuePromises = attrValueList.map((v) =>
      client.query("INSERT INTO attr_value (attr_id, value) VALUES ($1, $2)", [attrId, v])
    );
    await Promise.all(valuePromises);

    await client.query("COMMIT");
    client.release();
    res.json({ code: 200, message: "新增成功" });
  } catch (e) {
    await client.query("ROLLBACK");
    client.release();
    console.error("新增属性失败：", e);
    res.json({ code: 500, message: "服务器错误" });
  }
});

// 修改属性
app.post("/admin/product/attr/update", async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { categoryId, index, attrName, attrValueList } = req.body;

    if (!categoryId || index === undefined || !attrName || !attrValueList) {
      client.release();
      return res.json({ code: 400, message: "参数不完整" });
    }

    const cateId = Number(categoryId);
    const idx = Number(index);

    const attrRes = await client.query(
      "SELECT id FROM attr WHERE category_id=$1 ORDER BY id",
      [cateId]
    );
    const attrs = attrRes.rows;
    if (idx < 0 || idx >= attrs.length) {
      client.release();
      return res.json({ code: 400, message: "索引错误" });
    }
    const attrId = attrs[idx].id;

    await client.query("UPDATE attr SET name=$1 WHERE id=$2", [attrName, attrId]);
    await client.query("DELETE FROM attr_value WHERE attr_id=$1", [attrId]);

    const valuePromises = attrValueList.map((v) =>
      client.query("INSERT INTO attr_value (attr_id, value) VALUES ($1, $2)", [attrId, v])
    );
    await Promise.all(valuePromises);

    await client.query("COMMIT");
    client.release();
    res.json({ code: 200, message: "修改成功" });
  } catch (e) {
    await client.query("ROLLBACK");
    client.release();
    console.error("修改属性失败：", e);
    res.json({ code: 500, message: "服务器错误" });
  }
});

// 删除属性
app.post("/admin/product/attr/remove", async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { categoryId, index } = req.body;

    if (!categoryId || index === undefined) {
      client.release();
      return res.json({ code: 400, message: "参数不完整" });
    }

    const cateId = Number(categoryId);
    const idx = Number(index);

    const attrRes = await client.query(
      "SELECT id FROM attr WHERE category_id=$1 ORDER BY id",
      [cateId]
    );
    const attrs = attrRes.rows;
    if (idx < 0 || idx >= attrs.length) {
      client.release();
      return res.json({ code: 400, message: "索引错误" });
    }
    const attrId = attrs[idx].id;

    await client.query("DELETE FROM attr WHERE id=$1", [attrId]);
    await client.query("COMMIT");
    client.release();
    res.json({ code: 200, message: "删除成功" });
  } catch (e) {
    await client.query("ROLLBACK");
    client.release();
    console.error("删除属性失败：", e);
    res.json({ code: 500, message: "服务器错误" });
  }
});

// ==================== 3. 员工用户 CRUD（全替换为PG占位符） ====================
app.get("/admin/acl/user/:page/:limit", async (req, res) => {
  try {
    const { page, limit } = req.params;
    const username = req.query.username || "";
    const offset = (page - 1) * Number(limit);
    let records, total;

    if (username.trim()) {
      const like = `%${username.trim()}%`;
      const recRes = await emppool.query(
        "SELECT id, username, name, phone, create_time AS createTime, update_time AS updateTime FROM employee WHERE username LIKE $1 ORDER BY id LIMIT $2 OFFSET $3",
        [like, Number(limit), offset]
      );
      records = recRes.rows;

      const totalRes = await emppool.query(
        "SELECT COUNT(*) AS total FROM employee WHERE username LIKE $1",
        [like]
      );
      total = totalRes.rows[0].total;
    } else {
      const recRes = await emppool.query(
        "SELECT id, username, name, phone, create_time AS createTime, update_time AS updateTime FROM employee ORDER BY id LIMIT $1 OFFSET $2",
        [Number(limit), offset]
      );
      records = recRes.rows;

      const totalRes = await emppool.query("SELECT COUNT(*) AS total FROM employee");
      total = totalRes.rows[0].total;
    }

    res.json({
      code: 200,
      data: { records, total, current: Number(page), size: Number(limit) },
    });
  } catch (e) {
    console.error("查询员工失败：", e);
    res.json({ code: 500, message: "服务器错误" });
  }
});

// 添加员工
app.post("/admin/acl/user/save", async (req, res) => {
  try {
    const { username, name, password, phone } = req.body;
    if (!username || !name || !password) {
      return res.json({ code: 400, message: "参数不完整（username、name、password为必填）" });
    }
    const existRes = await emppool.query(
      "SELECT id FROM employee WHERE username=$1",
      [username]
    );
    if (existRes.rows.length > 0) {
      return res.json({ code: 400, message: "用户名已存在" });
    }
    await emppool.query(
      "INSERT INTO employee (username, name, password, phone) VALUES ($1, $2, $3, $4)",
      [username, name, password, phone || null]
    );
    res.json({ code: 200, message: "添加成功" });
  } catch (e) {
    console.error("添加员工失败：", e);
    res.json({ code: 500, message: "服务器错误" });
  }
});

// 修改员工
app.put("/admin/acl/user/update", async (req, res) => {
  try {
    const { id, username, name, phone } = req.body;
    if (!id || !username || !name) {
      return res.json({ code: 400, message: "参数不完整（id、username、name为必填）" });
    }
    await emppool.query(
      "UPDATE employee SET username=$1, name=$2, phone=$3 WHERE id=$4",
      [username, name, phone || null, id]
    );
    res.json({ code: 200, message: "修改成功" });
  } catch (e) {
    console.error("修改员工失败：", e);
    res.json({ code: 500, message: "服务器错误" });
  }
});

// 删除单个员工
app.delete("/admin/acl/user/remove/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) {
      return res.json({ code: 400, message: "缺少id" });
    }
    await emppool.query("DELETE FROM employee WHERE id=$1", [id]);
    res.json({ code: 200, message: "删除成功" });
  } catch (e) {
    console.error("删除员工失败：", e);
    res.json({ code: 500, message: "服务器错误" });
  }
});

// 批量删除员工（PG 标准数组查询 id = ANY($1)）
app.delete("/admin/acl/user/batchRemove", async (req, res) => {
  try {
    const idList = req.body;
    if (!Array.isArray(idList) || idList.length === 0) {
      return res.json({ code: 400, message: "参数格式错误，需提供id数组" });
    }
    await emppool.query("DELETE FROM employee WHERE id = ANY($1)", [idList]);
    res.json({ code: 200, message: "批量删除成功" });
  } catch (e) {
    console.error("批量删除员工失败：", e);
    res.json({ code: 500, message: "服务器错误" });
  }
});

// ==================== 4. 角色管理（全替换+修复BUG） ====================
// 获取角色列表（分页）
app.post("/admin/acl/role/list", async (req, res) => {
  try {
    const { currentPage, pageSize } = req.body;
    const offset = (currentPage - 1) * pageSize;
    const roleRes = await emppool.query(
      "SELECT id,rolename,employeenum FROM role LIMIT $1 OFFSET $2",
      [pageSize, offset]
    );
    const role = roleRes.rows;

    const totalRes = await emppool.query("SELECT COUNT(*) total FROM role");
    const total = totalRes.rows[0].total;

    res.json({ code: 200, data: { records: role, total: total } });
  } catch (error) {
    console.log("获取角色列表失败：", error)
    res.json({ code: 500, message: "服务器错误" })
  }
})

// 关键字获取角色
app.post("/admin/acl/role/keyword", async (req, res) => {
  try {
    const { keyword } = req.body;
    const keyRes = await emppool.query(
      "SELECT id,rolename,employeenum FROM role WHERE rolename LIKE $1",
      [`%${keyword}%`]
    );
    res.json({ code: 200, data: { records: keyRes.rows } })
  } catch (error) {
    console.log("获取角色列表失败：", error)
    res.json({ code: 500, message: "服务器错误" })
  }
})

// 添加角色
app.post("/admin/acl/role/save", async (req, res) => {
  try {
    const { roleName } = req.body;
    const nameRes = await emppool.query(
      "SELECT rolename FROM role WHERE rolename LIKE $1",
      [roleName]
    );
    if (nameRes.rows.length > 0) {
      res.json({ code: 500, message: "添加的角色已经存在，禁止重复添加！" })
    } else {
      await emppool.query(
        "INSERT INTO role(rolename,employeenum) VALUES($1, $2)",
        [roleName, 0]
      );
      res.json({ code: 200 })
    }
  } catch (error) {
    console.log("角色添加失败：", error)
    res.json({ code: 500, message: "服务器异常，添加失败！" })
  }
})

// 查询当前角色下的员工信息
app.post("/admin/acl/role/users", async (req, res) => {
  try {
    const { roleName } = req.body
    const empRes = await emppool.query(
      "SELECT id,name,phone FROM employee WHERE role LIKE $1",
      [`%${roleName}%`]
    );
    res.json({ code: 200, data: { records: empRes.rows } })
  } catch (error) {
    console.log("查询当前角色下员工信息失败！", error)
    res.json({ code: 500, message: "查询当前角色下员工信息失败！" })
  }
})

// 查询除当前角色下的所有员工
app.post("/admin/acl/role/all-employees", async (req, res) => {
  try {
    const { roleName } = req.body
    const empRes = await emppool.query(
      "SELECT id,name,role FROM employee WHERE role NOT LIKE $1 OR role IS NULL",
      [`%${roleName}%`]
    );
    res.json({ code: 200, data: { records: empRes.rows } })
  } catch (error) {
    console.log("获取员工信息失败！", error)
    res.json({ code: 500, message: "服务器异常，查询失败！" })
  }
})

// 分配角色（CASE 函数 PG 原生写法）
app.post("/admin/acl/role/assign", async (req, res) => {
  try {
    const { assignSelectedIds, roleName } = req.body
    await emppool.query(`
      UPDATE employee 
      SET role = CASE WHEN role IS NULL THEN $1 ELSE CONCAT(role, '、', $2) END 
      WHERE id = ANY($3::int[])`,
      [roleName, roleName, assignSelectedIds]
    );

    const numRes = await emppool.query(
      "SELECT employeenum FROM role WHERE rolename=$1",
      [roleName]
    );
    const employeeNum = numRes.rows[0].employeenum;
    const length = assignSelectedIds.length + employeeNum;

    await emppool.query(
      "UPDATE role SET employeenum=$1 WHERE rolename=$2",
      [length, roleName]
    );
    res.json({ code: 200 })
  } catch (error) {
    console.log(error)
    res.json({ code: 500, message: "服务器异常，角色分配失败！" })
  }
})

// 删除单个角色
app.post("/admin/acl/role/remove", async (req, res) => {
  try {
    const { removeid, removeroleName } = req.body
    await emppool.query("DELETE FROM role WHERE id=$1", [removeid])
    await emppool.query(`
      UPDATE employee 
      SET role = TRIM(BOTH '、' FROM REPLACE(CONCAT('、', role, '、'), CONCAT('、', $1, '、'), '、')) 
      WHERE role LIKE $2
    `, [removeroleName, `%${removeroleName}%`])
    res.json({ code: 200 })
  } catch (error) {
    console.log(error)
    res.json({ code: 500, message: "服务器异常，角色删除失败！" })
  }
})

// 批量删除角色（修复原代码 val 未定义BUG + PG 占位符）
app.post("/admin/acl/role/batchRemove", async (req, res) => {
  try {
    const { ids, roleNames } = req.body
    if ((!ids || ids.length === 0) && (!roleNames || roleNames.length === 0)) {
      res.json({ code: 500, message: '未勾选角色！' })
      return;
    }
    if (ids && ids.length > 0) {
      await emppool.query("DELETE FROM role WHERE id = ANY($1)", [ids])
    }
    if (roleNames && roleNames.length > 0) {
      await emppool.query(`
        UPDATE employee 
        SET role = TRIM(BOTH '、' FROM REPLACE(CONCAT('、', role, '、'), CONCAT('、', $1, '、'), '、')) 
        WHERE role = ANY($2)
      `, [roleNames, roleNames])
    }
    res.json({ code: 200 })
  } catch (error) {
    console.log(error)
    res.json({ code: 500, message: '服务器异常，角色批量删除失败！' })
  }
})

// 启动服务（适配Render：0.0.0.0 + 动态端口）
app.listen(port, '0.0.0.0', async () => {
  console.log(`\n✅ 企业级后端服务已启动：http://0.0.0.0:${port}`);
  console.log("📌 测试地址：");
  console.log("   品牌列表：http://localhost:8889/admin/product/baseTrademark/1/10");
  console.log("   一级分类：http://localhost:8889/admin/product/category/list/tree");
  console.log("   手机分类属性：http://localhost:8889/admin/product/attr/list/1011");
  console.log("   员工列表：http://localhost:8889/admin/acl/user/1/5");
  console.log("   角色列表：http://localhost:8889/admin/acl/role/1/5");
});
