const express = require("express");
const cors = require("cors");
const mysql = require("mysql2/promise");
const cookieParser = require('cookie-parser')
const app = express();
// Render会自动分配端口，本地开发仍用8889
const port = process.env.PORT || 8889;

// 中间件
// ========== 加这两行！解决所有返回中文乱码 ==========
app.use((req, res, next) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  next();
});
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "10mb" }));
app.use(cookieParser())


// ==================== MySQL 企业级连接池配置 ====================
const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "root",
  database: process.env.DB_NAME || "shop_admin",
  waitForConnections: true,
  connectionLimit: 20, // 企业级连接数
  queueLimit: 0,
  charset: "utf8mb4",
});

const emppool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "root",
  database: process.env.EMP_DB_NAME || "emp_db",
  waitForConnections: true,
  connectionLimit: 20, // 企业级连接数
  queueLimit: 0,
  charset: "utf8mb4",
});

// 测试数据库连接
pool
  .getConnection()
  .then((conn) => {
    console.log("✅ MySQL数据库连接成功");
    conn.release();
  })
  .catch((err) => {
    console.error("❌ MySQL连接失败，请检查账号密码：", err.message);
    process.exit(1);
  });


  // 模拟数据库
const user = {
  username: 'czw',
  password: '111111',
  token: 'czw-token-666',
  sessionId: null
}

// ======================
// 地址已改成：/user/login
// ======================
app.post('/user/login', (req, res) => {
  const token = req.headers.token

  // 自动登录：必须验证 sessionId！
  if (token && token === user.token) {
    const clientSessionId = req.cookies.SESSION_ID

    // 关键：黑客没有这个 sessionId，直接拦截！
    if (!clientSessionId || clientSessionId !== user.sessionId) {
      return res.json({ code: 401, message: '会话异常，请重新登录' })
    }

    return res.json({
      code: 200,
      message: 'token有效，自动登录成功',
      data: {
        token: user.token,
        username: user.username
      }
    })
  }

  // 账号密码登录
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
      data: {
        token: user.token,
        username: user.username
      }
    })
  }
  else{
    return res.json({
      code: 500,
      message: '账号或密码错误',
      data: null
    })
  }
})

// ======================
// 地址已改成：/user/info
// ======================
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
    data: {
      username: user.username
    }
  })
})


// ==================== 1. 品牌CRUD（100%兼容原接口） ====================
// 分页查询品牌
app.get("/admin/product/baseTrademark/:page/:limit", async (req, res) => {
  try {
    const { page, limit } = req.params;
    const offset = (page - 1) * Number(limit);

    const [records] = await pool.query(
      "SELECT id, tm_name AS tmName, logo_url AS logoUrl FROM base_trademark ORDER BY id LIMIT ? OFFSET ?",
      [Number(limit), offset]
    );
    const [totalResult] = await pool.query(
      "SELECT COUNT(*) AS total FROM base_trademark"
    );

    res.json({
      code: 200,
      data: {
        records,
        total: totalResult[0].total,
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
    const { tmName, logoUrl } = req.body;
    if (!tmName || !logoUrl) {
      return res.json({ code: 400, message: "参数不完整" });
    }
    await pool.query(
      "INSERT INTO base_trademark (tm_name, logo_url) VALUES (?, ?)",
      [tmName, logoUrl]
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
    const { id, tmName, logoUrl } = req.body;
    if (!id || !tmName || !logoUrl) {
      return res.json({ code: 400, message: "参数不完整" });
    }
    await pool.query(
      "UPDATE base_trademark SET tm_name=?, logo_url=? WHERE id=?",
      [tmName, logoUrl, id]
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
    await pool.query("DELETE FROM base_trademark WHERE id=?", [id]);
    res.json({ code: 200, message: "删除成功" });
  } catch (e) {
    console.error("删除品牌失败：", e);
    res.json({ code: 500, message: "服务器错误" });
  }
});

// ==================== 2. 三级分类 + 属性接口（100%兼容原接口） ====================
// 获取一级分类
app.get("/admin/product/category/list/tree", async (req, res) => {
  try {
    const [data] = await pool.query(
      "SELECT id, name FROM category WHERE parent_id=0 ORDER BY id"
    );
    res.json({ code: 200, data });
  } catch (e) {
    console.error("获取一级分类失败：", e);
    res.json({ code: 500, message: "服务器错误" });
  }
});

// 获取子分类（二级/三级）
app.get("/admin/product/category/list/:parentId", async (req, res) => {
  try {
    const parentId = Number(req.params.parentId);
    const [data] = await pool.query(
      "SELECT id, name FROM category WHERE parent_id=? ORDER BY id",
      [parentId]
    );
    res.json({ code: 200, data });
  } catch (e) {
    console.error("获取子分类失败：", e);
    res.json({ code: 500, message: "服务器错误" });
  }
});

// 获取当前三级分类的属性列表
app.get("/admin/product/attr/list/:categoryId", async (req, res) => {
  try {
    const categoryId = Number(req.params.categoryId);
    const [attrs] = await pool.query(
      "SELECT id, name FROM attr WHERE category_id=? ORDER BY id",
      [categoryId]
    );

    // 批量查询属性值（优化性能，避免N+1查询）
    for (let attr of attrs) {
      const [values] = await pool.query(
        "SELECT value FROM attr_value WHERE attr_id=? ORDER BY id",
        [attr.id]
      );
      attr.valueList = values.map((v) => v.value);
    }

    res.json({ code: 200, data: attrs });
  } catch (e) {
    console.error("获取属性失败：", e);
    res.json({ code: 500, message: "服务器错误" });
  }
});

// 新增属性
app.post("/admin/product/attr/save", async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const { categoryId, attrName, attrValueList } = req.body;

    if (
      !categoryId ||
      !attrName ||
      !attrValueList ||
      !Array.isArray(attrValueList)
    ) {
      return res.json({ code: 400, message: "参数不完整" });
    }

    // 插入属性
    const [attrResult] = await connection.query(
      "INSERT INTO attr (category_id, name) VALUES (?, ?)",
      [Number(categoryId), attrName]
    );
    const attrId = attrResult.insertId;

    // 批量插入属性值
    const valuePromises = attrValueList.map((v) =>
      connection.query(
        "INSERT INTO attr_value (attr_id, value) VALUES (?, ?)",
        [attrId, v]
      )
    );
    await Promise.all(valuePromises);

    await connection.commit();
    res.json({ code: 200, message: "新增成功" });
  } catch (e) {
    await connection.rollback();
    console.error("新增属性失败：", e);
    res.json({ code: 500, message: "服务器错误" });
  } finally {
    connection.release();
  }
});

// 修改属性（完全兼容原index参数）
app.post("/admin/product/attr/update", async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const { categoryId, index, attrName, attrValueList } = req.body;

    if (!categoryId || index === undefined || !attrName || !attrValueList) {
      return res.json({ code: 400, message: "参数不完整" });
    }

    const cateId = Number(categoryId);
    const idx = Number(index);

    // 按顺序获取属性ID（和原内存顺序完全一致）
    const [attrs] = await connection.query(
      "SELECT id FROM attr WHERE category_id=? ORDER BY id",
      [cateId]
    );
    if (idx < 0 || idx >= attrs.length) {
      return res.json({ code: 400, message: "索引错误" });
    }
    const attrId = attrs[idx].id;

    // 更新属性名称
    await connection.query("UPDATE attr SET name=? WHERE id=?", [
      attrName,
      attrId,
    ]);
    // 删除旧属性值
    await connection.query("DELETE FROM attr_value WHERE attr_id=?", [attrId]);
    // 插入新属性值
    const valuePromises = attrValueList.map((v) =>
      connection.query(
        "INSERT INTO attr_value (attr_id, value) VALUES (?, ?)",
        [attrId, v]
      )
    );
    await Promise.all(valuePromises);

    await connection.commit();
    res.json({ code: 200, message: "修改成功" });
  } catch (e) {
    await connection.rollback();
    console.error("修改属性失败：", e);
    res.json({ code: 500, message: "服务器错误" });
  } finally {
    connection.release();
  }
});

// 删除属性（完全兼容原index参数）
app.post("/admin/product/attr/remove", async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const { categoryId, index } = req.body;

    if (!categoryId || index === undefined) {
      return res.json({ code: 400, message: "参数不完整" });
    }

    const cateId = Number(categoryId);
    const idx = Number(index);

    const [attrs] = await connection.query(
      "SELECT id FROM attr WHERE category_id=? ORDER BY id",
      [cateId]
    );
    if (idx < 0 || idx >= attrs.length) {
      return res.json({ code: 400, message: "索引错误" });
    }
    const attrId = attrs[idx].id;

    // 外键会自动删除属性值，这里只需删除属性
    await connection.query("DELETE FROM attr WHERE id=?", [attrId]);

    await connection.commit();
    res.json({ code: 200, message: "删除成功" });
  } catch (e) {
    await connection.rollback();
    console.error("删除属性失败：", e);
    res.json({ code: 500, message: "服务器错误" });
  } finally {
    connection.release();
  }
});

// ==================== 3. 员工用户 CRUD（emp_db 数据库） ====================
// 分页查询员工（支持按用户名搜索）
app.get("/admin/acl/user/:page/:limit", async (req, res) => {
  try {
    const { page, limit } = req.params;
    const username = req.query.username || "";
    const offset = (page - 1) * Number(limit);

    let records, totalResult;
    if (username.trim()) {
      const like = `%${username.trim()}%`;
      [records] = await emppool.query(
        "SELECT id, username, name, phone, create_time AS createTime, update_time AS updateTime FROM employee WHERE username LIKE ? ORDER BY id LIMIT ? OFFSET ?",
        [like, Number(limit), offset]
      );
      [totalResult] = await emppool.query(
        "SELECT COUNT(*) AS total FROM employee WHERE username LIKE ?",
        [like]
      );
    } else {
      [records] = await emppool.query(
        "SELECT id, username, name, phone, create_time AS createTime, update_time AS updateTime FROM employee ORDER BY id LIMIT ? OFFSET ?",
        [Number(limit), offset]
      );
      [totalResult] = await emppool.query(
        "SELECT COUNT(*) AS total FROM employee"
      );
    }

    res.json({
      code: 200,
      data: {
        records,
        total: totalResult[0].total,
        current: Number(page),
        size: Number(limit),
      },
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
      return res.json({
        code: 400,
        message: "参数不完整（username、name、password为必填）",
      });
    }
    // 检查用户名是否已存在
    const [exist] = await emppool.query(
      "SELECT id FROM employee WHERE username=?",
      [username]
    );
    if (exist.length > 0) {
      return res.json({ code: 400, message: "用户名已存在" });
    }
    await emppool.query(
      "INSERT INTO employee (username, name, password, phone) VALUES (?, ?, ?, ?)",
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
      return res.json({
        code: 400,
        message: "参数不完整（id、username、name为必填）",
      });
    }
    await emppool.query(
      "UPDATE employee SET username=?, name=?, phone=? WHERE id=?",
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
    await emppool.query("DELETE FROM employee WHERE id=?", [id]);
    res.json({ code: 200, message: "删除成功" });
  } catch (e) {
    console.error("删除员工失败：", e);
    res.json({ code: 500, message: "服务器错误" });
  }
});

// 批量删除员工
app.delete("/admin/acl/user/batchRemove", async (req, res) => {
  try {
    const idList = req.body;
    if (!Array.isArray(idList) || idList.length === 0) {
      return res.json({ code: 400, message: "参数格式错误，需提供id数组" });
    }
    await emppool.query("DELETE FROM employee WHERE id IN (?)",[idList]);
    res.json({ code: 200, message: "批量删除成功" });
  } catch (e) {
    console.error("批量删除员工失败：", e);
    res.json({ code: 500, message: "服务器错误" });
  }
});

// ==================== 4. 角色管理（基于 employee 表，与用户管理同步） ====================
// 获取角色列表（分页）- 从 employee 表按 role 分组
app.post("/admin/acl/role/list",async(req,res)=>{
   try {
     const {currentPage,pageSize}=req.body;
     const offset=(currentPage-1)*pageSize;
     const [role]=await emppool.query("SELECT id,roleName,employeeNum FROM role Limit ? OFFSET ?",[pageSize,offset])
     const [totalData]=await emppool.query("SELECT COUNT(*) total FROM role")
     const total = totalData[0].total;
     res.json({code:200,data:{records:role,total:total}})
   } catch (error) {
    console.log("获取角色列表失败：",error)
    res.json({code:500,message:"服务器错误"})
   }
})

//关键字获取角色
app.post("/admin/acl/role/keyword",async(req,res)=>{
  try {
    const {keyword}=req.body;
    const [keyrole]=await emppool.query("SELECT id,roleName,employeeNum FROM role WHERE roleName LIKE ?",[`%${keyword}%`])
    res.json({code:200,data:{records:keyrole}})  
  } catch (error) {
    console.log("获取角色列表失败：",error)
    res.json({code:500,message:"服务器错误"})
  }
})

//添加角色
app.post("/admin/acl/role/save",async(req,res)=>{
    try {
      const {roleName}=req.body;
      const [Name]=await emppool.query("SELECT roleName FROM role WHERE roleName LIKE ?",[roleName])
      if(Name.length>0){
        res.json({code:500,message:"添加的角色已经存在，禁止重复添加！"})
      }
      else{
        await emppool.query("INSERT INTO role(roleName,employeeNum) VALUES(?,?)",[roleName,0])
        res.json({code:200})
      }
    } catch (error) {
      console.log("角色添加失败：",error)
      res.json({code:500,message:"服务器异常，添加失败！"})
    }
})

//查询当前角色下的员工信息
app.post("/admin/acl/role/users",async(req,res)=>{
   try {
     const {roleName}=req.body
     const [employee]=await emppool.query("SELECT id,name,phone FROM employee WHERE role LIKE ?",[`%${roleName}%`])
     res.json({code:200,data:{records:employee}})
   } catch (error) {
    console.log("查询当前角色下员工信息失败！",error)
    res.json({code:500,message:"查询当前角色下员工信息失败！"})
   }
})

//查询除当前角色下的所有员工（用于分配角色）
app.post("/admin/acl/role/all-employees",async(req,res)=>{
   try {
     const {roleName}=req.body
     const [employees]=await emppool.query("SELECT id,name,role FROM employee WHERE role NOT LIKE ? OR role IS NULL",[`%${roleName}%`])
     res.json({code:200,data:{records:employees}})
   } catch (error) {
    console.log("获取员工信息失败！",error)
    res.json({code:500,message:"服务器异常，查询失败！"})
   }
})

//分配当前角色给选中员工
app.post("/admin/acl/role/assign",async(req,res)=>{
    try {
      const {assignSelectedIds,roleName} = req.body
      await emppool.query(
        `UPDATE employee 
         SET role = IF(role IS NULL, ?, CONCAT(role, '、', ?)) 
         WHERE id IN (?)`,
        [roleName, roleName, assignSelectedIds]
      );
      const [employeeNum]=await emppool.query("SELECT employeeNum FROM role WHERE roleName=?",[roleName])
      const length=assignSelectedIds.length+employeeNum[0].employeeNum
      await emppool.query("UPDATE role SET employeeNum=? WHERE roleName=?",[length,roleName])
      res.json({code:200})
    } catch (error) {
      console.log(error)
      res.json({code:500,message:"服务器异常，角色分配失败！"})
    }
})

//删除当前角色
app.post("/admin/acl/role/remove",async(req,res)=>{
  try {
    const {removeid,removeroleName}=req.body
    await emppool.query("DELETE FROM role WHERE id=?",[removeid])
    await emppool.query(`
      UPDATE employee 
      SET role = TRIM(BOTH '、' FROM REPLACE(CONCAT('、', role, '、'), CONCAT('、', ?, '、'), '、')) 
      WHERE role LIKE ?
    `, [removeroleName, `%${removeroleName}%`])
    res.json({code:200})
  } catch (error) {
    console.log(error)
    res.json({code:500,message:"服务器异常，角色删除失败！"})
  }
})

//批量删除已勾选的角色
app.post("/admin/acl/role/batchRemove",async(req,res)=>{
   try {
     const {ids,roleNames}=req.body
     if(ids==[]&&roleNames==[]){
      res.json({code:500,message:'未勾选角色！'})
     }
     await emppool.query("Delect FROM role WHERE id in [?]",[ids])
     await emppool.query(`
      UPDATE employee 
      SET role = TRIM(BOTH '、' FROM REPLACE(CONCAT('、', role, '、'), CONCAT('、', ?, '、'), '、')) 
      WHERE role in [?]
    `,[ids,roleNames])
    res.json({code:200})
   } catch (error) {
     console.log(error)
     res.json({code:500,message:'服务器异常，角色批量删除失败！'})
   }
})


// ==================== 完整初始化数据（首次运行自动执行） ====================
async function initAllData() {
  console.log("🔍 检查数据库是否需要初始化...");

  // 1. 初始化品牌数据
  const [trademarkCount] = await pool.query(
    "SELECT COUNT(*) AS count FROM base_trademark"
  );
  if (trademarkCount[0].count === 0) {
    console.log("✅ 正在初始化品牌数据（50条）...");
    const imgList = Array.from(
      { length: 50 },
      (_, i) => `https://picsum.photos/id/${i + 1}/200/200`
    );
    const brandValues = imgList.map((url, i) => [`测试品牌${i + 1}`, url]);
    await pool.query(
      "INSERT INTO base_trademark (tm_name, logo_url) VALUES ?",
      [brandValues]
    );
    console.log("✅ 品牌数据初始化完成");
  }

  // 2. 初始化完整三级分类+属性数据
  const [categoryCount] = await pool.query(
    "SELECT COUNT(*) AS count FROM category"
  );
  if (categoryCount[0].count === 0) {
    console.log("✅ 正在初始化完整三级分类+属性数据...");
    const connection = await pool.getConnection();
    await connection.beginTransaction();

    // 完整分类数据（完全复制你提供的原始数据）
    const categoryData = [
      {
        id: 1,
        name: "电器",
        children: [
          {
            id: 101,
            name: "手机",
            children: [
              {
                id: 1011,
                name: "华为",
                attrList: [
                  { id: 1, name: "屏幕尺寸", valueList: ["6.1寸", "6.7寸"] },
                  {
                    id: 2,
                    name: "电池容量",
                    valueList: ["4500mAh", "5000mAh"],
                  },
                  {
                    id: 3,
                    name: "机身颜色",
                    valueList: ["黑色", "白色", "橙色"],
                  },
                ],
              },
              {
                id: 1012,
                name: "苹果",
                attrList: [
                  { id: 2, name: "颜色", valueList: ["白色", "黑色"] },
                  {
                    id: 3,
                    name: "存储容量",
                    valueList: ["128G", "256G", "512G"],
                  },
                  { id: 4, name: "处理器", valueList: ["A15", "A16", "A17"] },
                ],
              },
              {
                id: 1013,
                name: "小米",
                attrList: [
                  { id: 3, name: "内存", valueList: ["8G", "12G", "16G"] },
                  { id: 4, name: "电池", valueList: ["5000mAh", "5500mAh"] },
                  {
                    id: 5,
                    name: "快充功率",
                    valueList: ["67W", "90W", "120W"],
                  },
                ],
              },
              {
                id: 1014,
                name: "OPPO",
                attrList: [
                  { id: 4, name: "拍照", valueList: ["5000万", "1亿"] },
                  {
                    id: 5,
                    name: "充电速度",
                    valueList: ["65W", "80W", "100W"],
                  },
                  { id: 6, name: "机身颜色", valueList: ["绿", "紫", "蓝"] },
                ],
              },
              {
                id: 1015,
                name: "vivo",
                attrList: [
                  { id: 5, name: "音质", valueList: ["立体声", "环绕声"] },
                  { id: 6, name: "屏幕材质", valueList: ["AMOLED", "OLED"] },
                  { id: 7, name: "配色", valueList: ["粉", "蓝", "黑"] },
                ],
              },
            ],
          },
          {
            id: 102,
            name: "空调",
            children: [
              {
                id: 1021,
                name: "格力",
                attrList: [
                  { id: 6, name: "匹数", valueList: ["1匹", "1.5匹"] },
                  { id: 7, name: "能效等级", valueList: ["一级", "二级"] },
                  { id: 8, name: "制冷类型", valueList: ["冷暖", "单冷"] },
                ],
              },
              {
                id: 1022,
                name: "美的",
                attrList: [
                  { id: 7, name: "变频", valueList: ["是", "否"] },
                  { id: 8, name: "静音功能", valueList: ["支持", "不支持"] },
                  { id: 9, name: "自清洁", valueList: ["支持", "不支持"] },
                ],
              },
              {
                id: 1023,
                name: "海尔",
                attrList: [
                  { id: 8, name: "静音", valueList: ["支持", "不支持"] },
                  { id: 9, name: "节能模式", valueList: ["支持", "不支持"] },
                  { id: 10, name: "WiFi控制", valueList: ["支持", "不支持"] },
                ],
              },
              {
                id: 1024,
                name: "海信",
                attrList: [
                  { id: 9, name: "节能", valueList: ["一级", "二级"] },
                  { id: 10, name: "制冷量", valueList: ["2500W", "3500W"] },
                  { id: 11, name: "噪音", valueList: ["低噪", "超静音"] },
                ],
              },
            ],
          },
          {
            id: 103,
            name: "洗衣机",
            children: [
              {
                id: 1031,
                name: "小天鹅",
                attrList: [
                  { id: 10, name: "容量", valueList: ["8kg", "10kg"] },
                  {
                    id: 11,
                    name: "洗涤模式",
                    valueList: ["标准", "快洗", "大件"],
                  },
                ],
              },
              {
                id: 1032,
                name: "西门子",
                attrList: [
                  { id: 11, name: "类型", valueList: ["滚筒", "波轮"] },
                  { id: 12, name: "烘干功能", valueList: ["支持", "不支持"] },
                ],
              },
              {
                id: 1033,
                name: "松下",
                attrList: [
                  { id: 12, name: "烘干", valueList: ["支持", "不支持"] },
                  { id: 13, name: "变频电机", valueList: ["是", "否"] },
                ],
              },
            ],
          },
          {
            id: 104,
            name: "冰箱",
            children: [
              {
                id: 1041,
                name: "海尔",
                attrList: [
                  { id: 13, name: "容积", valueList: ["200L", "300L"] },
                  { id: 14, name: "制冷方式", valueList: ["风冷", "直冷"] },
                ],
              },
              {
                id: 1042,
                name: "美的",
                attrList: [
                  { id: 14, name: "制冷", valueList: ["风冷", "直冷"] },
                  { id: 15, name: "面板材质", valueList: ["钢化玻璃", "金属"] },
                ],
              },
              {
                id: 1043,
                name: "容声",
                attrList: [
                  {
                    id: 15,
                    name: "门数",
                    valueList: ["双门", "三门", "对开门"],
                  },
                  { id: 16, name: "保湿保鲜", valueList: ["支持", "不支持"] },
                ],
              },
            ],
          },
        ],
      },
      {
        id: 2,
        name: "服装",
        children: [
          {
            id: 201,
            name: "男装",
            children: [
              {
                id: 2011,
                name: "海澜之家",
                attrList: [
                  { id: 16, name: "尺码", valueList: ["M", "L", "XL"] },
                  { id: 17, name: "版型", valueList: ["修身", "宽松", "常规"] },
                  { id: 18, name: "风格", valueList: ["商务", "休闲", "潮流"] },
                ],
              },
              {
                id: 2012,
                name: "七匹狼",
                attrList: [
                  { id: 17, name: "风格", valueList: ["商务", "休闲"] },
                  { id: 18, name: "材质", valueList: ["纯棉", "涤纶", "混纺"] },
                ],
              },
              {
                id: 2013,
                name: "劲霸",
                attrList: [
                  { id: 18, name: "版型", valueList: ["修身", "宽松"] },
                  {
                    id: 19,
                    name: "适用季节",
                    valueList: ["春季", "秋季", "冬季"],
                  },
                ],
              },
            ],
          },
          {
            id: 202,
            name: "女装",
            children: [
              {
                id: 2021,
                name: "优衣库",
                attrList: [
                  { id: 19, name: "风格", valueList: ["休闲", "通勤"] },
                  { id: 20, name: "材质", valueList: ["棉", "麻", "化纤"] },
                ],
              },
              {
                id: 2022,
                name: "ZARA",
                attrList: [
                  { id: 20, name: "季节", valueList: ["春", "夏", "秋", "冬"] },
                  {
                    id: 21,
                    name: "款式",
                    valueList: ["连衣裙", "外套", "衬衫"],
                  },
                ],
              },
              {
                id: 2023,
                name: "HM",
                attrList: [
                  { id: 21, name: "款式", valueList: ["连衣裙", "外套"] },
                  {
                    id: 22,
                    name: "颜色",
                    valueList: ["黑", "白", "灰", "卡其"],
                  },
                ],
              },
            ],
          },
          {
            id: 203,
            name: "童装",
            children: [
              {
                id: 2031,
                name: "巴拉巴拉",
                attrList: [
                  { id: 22, name: "年龄", valueList: ["3岁", "6岁"] },
                  { id: 23, name: "性别", valueList: ["男童", "女童", "通用"] },
                ],
              },
              {
                id: 2032,
                name: "安奈儿",
                attrList: [
                  { id: 23, name: "材质", valueList: ["纯棉", "涤纶"] },
                  { id: 24, name: "厚度", valueList: ["薄款", "常规", "加厚"] },
                ],
              },
            ],
          },
        ],
      },
      {
        id: 3,
        name: "食品",
        children: [
          {
            id: 301,
            name: "零食",
            children: [
              {
                id: 3011,
                name: "三只松鼠",
                attrList: [
                  { id: 24, name: "口味", valueList: ["原味", "香辣"] },
                  { id: 25, name: "规格", valueList: ["小包", "中包", "大包"] },
                ],
              },
              {
                id: 3012,
                name: "良品铺子",
                attrList: [
                  { id: 25, name: "口感", valueList: ["酥脆", "软糯"] },
                  { id: 26, name: "系列", valueList: ["坚果", "肉干", "糖果"] },
                ],
              },
              {
                id: 3013,
                name: "百草味",
                attrList: [
                  { id: 26, name: "包装", valueList: ["袋装", "盒装"] },
                  {
                    id: 27,
                    name: "保质期",
                    valueList: ["6个月", "9个月", "12个月"],
                  },
                ],
              },
            ],
          },
          {
            id: 302,
            name: "饮料",
            children: [
              {
                id: 3021,
                name: "可口可乐",
                attrList: [
                  { id: 27, name: "容量", valueList: ["500ml", "1L"] },
                  {
                    id: 28,
                    name: "版本",
                    valueList: ["普通", "无糖", "纤维+"],
                  },
                ],
              },
              {
                id: 3022,
                name: "百事可乐",
                attrList: [
                  { id: 28, name: "口味", valueList: ["原味", "无糖"] },
                  { id: 29, name: "包装", valueList: ["瓶装", "罐装"] },
                ],
              },
              {
                id: 3023,
                name: "康师傅",
                attrList: [
                  { id: 29, name: "种类", valueList: ["冰红茶", "绿茶"] },
                  { id: 30, name: "甜度", valueList: ["正常糖", "少糖"] },
                ],
              },
            ],
          },
          {
            id: 303,
            name: "生鲜",
            children: [
              {
                id: 3031,
                name: "水果",
                attrList: [
                  { id: 30, name: "品种", valueList: ["苹果", "香蕉"] },
                  { id: 31, name: "产地", valueList: ["山东", "海南", "进口"] },
                ],
              },
              {
                id: 3032,
                name: "蔬菜",
                attrList: [
                  { id: 31, name: "种类", valueList: ["青菜", "萝卜"] },
                  { id: 32, name: "等级", valueList: ["一级", "特级"] },
                ],
              },
            ],
          },
        ],
      },
      {
        id: 4,
        name: "美妆",
        children: [
          {
            id: 401,
            name: "口红",
            children: [
              {
                id: 4011,
                name: "迪奥",
                attrList: [
                  { id: 32, name: "色号", valueList: ["999", "888"] },
                  { id: 33, name: "质地", valueList: ["丝绒", "滋润", "哑光"] },
                ],
              },
              {
                id: 4012,
                name: "香奈儿",
                attrList: [
                  { id: 33, name: "质地", valueList: ["丝绒", "滋润"] },
                  { id: 34, name: "系列", valueList: ["经典", "限量"] },
                ],
              },
              {
                id: 4013,
                name: "YSL",
                attrList: [
                  { id: 34, name: "系列", valueList: ["小金条", "小粉条"] },
                  { id: 35, name: "光泽", valueList: ["哑光", "珠光", "滋润"] },
                ],
              },
            ],
          },
          {
            id: 402,
            name: "粉底",
            children: [
              {
                id: 4021,
                name: "雅诗兰黛",
                attrList: [
                  { id: 35, name: "色号", valueList: ["自然色", "亮肤色"] },
                  { id: 36, name: "妆效", valueList: ["哑光", "奶油肌"] },
                ],
              },
              {
                id: 4022,
                name: "兰蔻",
                attrList: [
                  { id: 36, name: "持妆", valueList: ["12h", "24h"] },
                  { id: 37, name: "遮瑕", valueList: ["轻度", "中度", "高度"] },
                ],
              },
            ],
          },
          {
            id: 403,
            name: "眼影",
            children: [
              {
                id: 4031,
                name: "TF",
                attrList: [
                  { id: 37, name: "配色", valueList: ["大地色", "蜜桃色"] },
                  { id: 38, name: "质地", valueList: ["哑光", "珠光"] },
                ],
              },
              {
                id: 4032,
                name: "UrbanDecay",
                attrList: [
                  { id: 38, name: "质地", valueList: ["哑光", "珠光"] },
                  { id: 39, name: "配色数量", valueList: ["12色", "16色"] },
                ],
              },
            ],
          },
        ],
      },
      {
        id: 5,
        name: "数码",
        children: [
          {
            id: 501,
            name: "耳机",
            children: [
              {
                id: 5011,
                name: "索尼",
                attrList: [
                  { id: 39, name: "类型", valueList: ["入耳", "头戴"] },
                  { id: 40, name: "降噪", valueList: ["主动", "被动"] },
                ],
              },
              {
                id: 5012,
                name: "BOSE",
                attrList: [
                  { id: 40, name: "降噪", valueList: ["主动", "被动"] },
                  { id: 41, name: "续航", valueList: ["10h", "20h", "30h"] },
                ],
              },
              {
                id: 5013,
                name: "苹果",
                attrList: [
                  { id: 41, name: "连接", valueList: ["蓝牙", "有线"] },
                  { id: 42, name: "空间音频", valueList: ["支持", "不支持"] },
                ],
              },
            ],
          },
          {
            id: 502,
            name: "平板",
            children: [
              {
                id: 5021,
                name: "iPad",
                attrList: [
                  { id: 42, name: "尺寸", valueList: ["10.9寸", "12.9寸"] },
                  { id: 43, name: "性能", valueList: ["标准版", "Pro版"] },
                ],
              },
              {
                id: 5022,
                name: "华为平板",
                attrList: [
                  { id: 43, name: "系统", valueList: ["鸿蒙", "安卓"] },
                  { id: 44, name: "屏幕", valueList: ["LCD", "OLED"] },
                ],
              },
            ],
          },
          {
            id: 503,
            name: "相机",
            children: [
              {
                id: 5031,
                name: "佳能",
                attrList: [
                  { id: 44, name: "像素", valueList: ["2000w", "3000w"] },
                  { id: 45, name: "级别", valueList: ["入门", "专业"] },
                ],
              },
              {
                id: 5032,
                name: "尼康",
                attrList: [
                  { id: 45, name: "类型", valueList: ["单反", "微单"] },
                  {
                    id: 46,
                    name: "适用场景",
                    valueList: ["家用", "旅行", "专业"],
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        id: 6,
        name: "家具",
        children: [
          {
            id: 601,
            name: "沙发",
            children: [
              {
                id: 6011,
                name: "顾家家居",
                attrList: [
                  { id: 46, name: "材质", valueList: ["布艺", "皮质"] },
                  { id: 47, name: "座位", valueList: ["单人", "双人", "三人"] },
                ],
              },
              {
                id: 6012,
                name: "芝华仕",
                attrList: [
                  { id: 47, name: "功能", valueList: ["电动", "手动"] },
                  { id: 48, name: "伸展", valueList: ["支持", "不支持"] },
                ],
              },
            ],
          },
          {
            id: 602,
            name: "床",
            children: [
              {
                id: 6021,
                name: "喜临门",
                attrList: [
                  { id: 48, name: "尺寸", valueList: ["1.5m", "1.8m"] },
                  { id: 49, name: "风格", valueList: ["现代", "简约", "欧式"] },
                ],
              },
              {
                id: 6022,
                name: "雅兰",
                attrList: [
                  { id: 49, name: "床垫", valueList: ["弹簧", "乳胶"] },
                  {
                    id: 50,
                    name: "软硬度",
                    valueList: ["偏软", "适中", "偏硬"],
                  },
                ],
              },
            ],
          },
          {
            id: 603,
            name: "桌子",
            children: [
              {
                id: 6031,
                name: "书桌",
                attrList: [
                  { id: 50, name: "材质", valueList: ["实木", "板式"] },
                  { id: 51, name: "带抽屉", valueList: ["是", "否"] },
                ],
              },
              {
                id: 6032,
                name: "餐桌",
                attrList: [
                  { id: 51, name: "形状", valueList: ["圆形", "方形"] },
                  {
                    id: 52,
                    name: "适用人数",
                    valueList: ["4人", "6人", "8人"],
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        id: 7,
        name: "母婴",
        children: [
          {
            id: 701,
            name: "奶粉",
            children: [
              {
                id: 7011,
                name: "飞鹤",
                attrList: [
                  { id: 52, name: "段数", valueList: ["1段", "2段", "3段"] },
                  {
                    id: 53,
                    name: "适合年龄",
                    valueList: ["0-6月", "6-12月", "1-3岁"],
                  },
                ],
              },
              {
                id: 7012,
                name: "爱他美",
                attrList: [
                  { id: 53, name: "产地", valueList: ["德国", "新西兰"] },
                  { id: 54, name: "配方", valueList: ["经典", "白金版"] },
                ],
              },
            ],
          },
          {
            id: 702,
            name: "纸尿裤",
            children: [
              {
                id: 7021,
                name: "帮宝适",
                attrList: [
                  { id: 54, name: "尺码", valueList: ["S", "M", "L"] },
                  { id: 55, name: "吸水量", valueList: ["日常", "夜用"] },
                ],
              },
              {
                id: 7022,
                name: "花王",
                attrList: [
                  { id: 55, name: "材质", valueList: ["棉柔", "网面"] },
                  { id: 56, name: "透气", valueList: ["高透气", "普通"] },
                ],
              },
            ],
          },
          {
            id: 703,
            name: "婴儿车",
            children: [
              {
                id: 7031,
                name: "好孩子",
                attrList: [
                  { id: 56, name: "类型", valueList: ["轻便型", "高景观"] },
                  { id: 57, name: "可坐可躺", valueList: ["是", "否"] },
                ],
              },
              {
                id: 7032,
                name: "博格步",
                attrList: [
                  { id: 57, name: "避震", valueList: ["四级", "六级"] },
                  { id: 58, name: "折叠", valueList: ["单手折叠", "双手折叠"] },
                ],
              },
            ],
          },
        ],
      },
      {
        id: 8,
        name: "图书",
        children: [
          {
            id: 801,
            name: "小说",
            children: [
              {
                id: 8011,
                name: "文学小说",
                attrList: [
                  { id: 58, name: "作者", valueList: ["余华", "莫言"] },
                  {
                    id: 59,
                    name: "体裁",
                    valueList: ["长篇", "短篇", "散文集"],
                  },
                ],
              },
              {
                id: 8012,
                name: "科幻小说",
                attrList: [
                  { id: 59, name: "题材", valueList: ["星际", "末世"] },
                  { id: 60, name: "热度", valueList: ["热门", "经典"] },
                ],
              },
            ],
          },
          {
            id: 802,
            name: "科技",
            children: [
              {
                id: 8021,
                name: "编程",
                attrList: [
                  { id: 60, name: "语言", valueList: ["Java", "Python"] },
                  { id: 61, name: "难度", valueList: ["入门", "进阶", "高级"] },
                ],
              },
              {
                id: 8022,
                name: "设计",
                attrList: [
                  { id: 61, name: "软件", valueList: ["PS", "AI"] },
                  { id: 62, name: "方向", valueList: ["平面", "UI", "三维"] },
                ],
              },
            ],
          },
          {
            id: 803,
            name: "少儿",
            children: [
              {
                id: 8031,
                name: "绘本",
                attrList: [
                  { id: 62, name: "年龄", valueList: ["3-6岁", "7-10岁"] },
                  {
                    id: 63,
                    name: "主题",
                    valueList: ["启蒙", "益智", "情绪管理"],
                  },
                ],
              },
              {
                id: 8032,
                name: "童话",
                attrList: [
                  { id: 63, name: "类型", valueList: ["安徒生", "格林"] },
                  { id: 64, name: "篇幅", valueList: ["短篇", "长篇"] },
                ],
              },
            ],
          },
        ],
      },
    ];

    // 递归插入分类
    async function insertCategories(list, parentId = 0) {
      for (const item of list) {
        await connection.query(
          "INSERT INTO category (id, name, parent_id) VALUES (?, ?, ?)",
          [item.id, item.name, parentId]
        );

        // 插入三级分类的属性和属性值
        if (item.attrList && item.attrList.length > 0) {
          for (const attr of item.attrList) {
            const [attrResult] = await connection.query(
              "INSERT INTO attr (category_id, name) VALUES (?, ?)",
              [item.id, attr.name]
            );
            const attrId = attrResult.insertId;

            // 插入属性值
            const valueValues = attr.valueList.map((v) => [attrId, v]);
            await connection.query(
              "INSERT INTO attr_value (attr_id, value) VALUES ?",
              [valueValues]
            );
          }
        }

        // 递归插入子分类
        if (item.children && item.children.length > 0) {
          await insertCategories(item.children, item.id);
        }
      }
    }

    await insertCategories(categoryData);
    await connection.commit();
    connection.release();
    console.log("✅ 完整三级分类+属性数据初始化完成");
  }

  // 3. 初始化 emp_db 员工表
  try {
    const [empCount] = await emppool.query(
      "SELECT COUNT(*) AS count FROM employee"
    );
    if (empCount[0].count === 0) {
      console.log("✅ 正在初始化员工数据（30条）...");

      // 30个员工数据（从userdata.json提取）
      const employees = [
        {
          username: "admin",
          name: "管理员",
          password: "111111",
          phone: "13800000001",
          role: "超级管理员",
        },
        {
          username: "shanggu",
          name: "尚古",
          password: "111111",
          phone: "13800000002",
          role: "测试",
        },
        {
          username: "agui",
          name: "阿贵",
          password: "111111",
          phone: "13800000003",
          role: "前台",
        },
        {
          username: "ggsr",
          name: "硅谷超人",
          password: "111111",
          phone: "13800000004",
          role: "后端开发",
        },
        {
          username: "zhangsan",
          name: "张三",
          password: "111111",
          phone: "13800000005",
          role: "前端、测试",
        },
        {
          username: "lisi",
          name: "李四",
          password: "111111",
          phone: "13800000006",
          role: "产品经理",
        },
        {
          username: "wangwu",
          name: "王五",
          password: "111111",
          phone: "13800000007",
          role: "运维工程师",
        },
        {
          username: "zhaoliu",
          name: "赵六",
          password: "111111",
          phone: "13800000008",
          role: "UI设计",
        },
        {
          username: "qianqi",
          name: "钱七",
          password: "111111",
          phone: "13800000009",
          role: "测试工程师",
        },
        {
          username: "sunba",
          name: "孙八",
          password: "111111",
          phone: "13800000010",
          role: "后端开发",
        },
        {
          username: "zhoujiu",
          name: "周小九",
          password: "111111",
          phone: "13800000011",
          role: "前端开发",
        },
        {
          username: "wushi",
          name: "吴十",
          password: "111111",
          phone: "13800000012",
          role: "人事专员",
        },
        {
          username: "zhengsy",
          name: "郑十一",
          password: "111111",
          phone: "13800000013",
          role: "财务出纳",
        },
        {
          username: "fengse",
          name: "冯十二",
          password: "111111",
          phone: "13800000014",
          role: "项目经理",
        },
        {
          username: "chenss",
          name: "陈十三",
          password: "111111",
          phone: "13800000015",
          role: "运维主管",
        },
        {
          username: "chuss",
          name: "褚十四",
          password: "111111",
          phone: "13800000016",
          role: "前端、产品",
        },
        {
          username: "weish",
          name: "卫十五",
          password: "111111",
          phone: "13800000017",
          role: "测试、后端",
        },
        {
          username: "jiangsh",
          name: "蒋十六",
          password: "111111",
          phone: "13800000018",
          role: "行政文员",
        },
        {
          username: "shensh",
          name: "沈十七",
          password: "111111",
          phone: "13800000019",
          role: "数据分析师",
        },
        {
          username: "hansh",
          name: "韩十八",
          password: "111111",
          phone: "13800000020",
          role: "Java后端",
        },
        {
          username: "yangsh",
          name: "杨十九",
          password: "111111",
          phone: "13800000021",
          role: "Vue前端",
        },
        {
          username: "zhuers",
          name: "朱二十",
          password: "111111",
          phone: "13800000022",
          role: "测试主管",
        },
        {
          username: "qinery",
          name: "秦二一",
          password: "111111",
          phone: "13800000023",
          role: "财务主管",
        },
        {
          username: "youer",
          name: "尤二二",
          password: "111111",
          phone: "13800000024",
          role: "销售专员",
        },
        {
          username: "xuer",
          name: "许二三",
          password: "111111",
          phone: "13800000025",
          role: "客服专员",
        },
        {
          username: "heer",
          name: "何二四",
          password: "111111",
          phone: "13800000026",
          role: "全栈开发",
        },
        {
          username: "lyuer",
          name: "吕二五",
          password: "111111",
          phone: "13800000027",
          role: "产品测试",
        },
        {
          username: "shier",
          name: "施二六",
          password: "111111",
          phone: "13800000028",
          role: "后端、运维",
        },
        {
          username: "zhaner",
          name: "张二七",
          password: "111111",
          phone: "13800000029",
          role: "UI、交互设计",
        },
        {
          username: "konger",
          name: "孔二八",
          password: "111111",
          phone: "13800000030",
          role: "实习生、测试",
        },
      ];

      const values = employees.map((e) => [
        e.username,
        e.name,
        e.password,
        e.phone,
        e.role,
      ]);
      await emppool.query(
        "INSERT INTO employee (username, name, password, phone, role) VALUES ?",
        [values]
      );
      console.log("✅ 员工数据（30条）初始化完成");
    }
  } catch (e) {
    console.error(
      "员工表初始化失败（可能是表不存在，将自动创建）：",
      e.message
    );
    // 如果表不存在则创建表
    await emppool.query(`
      CREATE TABLE IF NOT EXISTS employee (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(50) NOT NULL UNIQUE,
        name VARCHAR(50) NOT NULL,
        password VARCHAR(100) NOT NULL,
        phone VARCHAR(20) DEFAULT NULL,
        role VARCHAR(100) DEFAULT NULL,
        create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
        update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    console.log("✅ 员工表创建成功，正在重新初始化数据...");
    // 重新插入
    const employees = [
      {
        username: "admin",
        name: "管理员",
        password: "111111",
        phone: "13800000001",
        role: "超级管理员",
      },
      {
        username: "shanggu",
        name: "尚古",
        password: "111111",
        phone: "13800000002",
        role: "测试",
      },
      {
        username: "agui",
        name: "阿贵",
        password: "111111",
        phone: "13800000003",
        role: "前台",
      },
      {
        username: "ggsr",
        name: "硅谷超人",
        password: "111111",
        phone: "13800000004",
        role: "后端开发",
      },
      {
        username: "zhangsan",
        name: "张三",
        password: "111111",
        phone: "13800000005",
        role: "前端、测试",
      },
      {
        username: "lisi",
        name: "李四",
        password: "111111",
        phone: "13800000006",
        role: "产品经理",
      },
      {
        username: "wangwu",
        name: "王五",
        password: "111111",
        phone: "13800000007",
        role: "运维工程师",
      },
      {
        username: "zhaoliu",
        name: "赵六",
        password: "111111",
        phone: "13800000008",
        role: "UI设计",
      },
      {
        username: "qianqi",
        name: "钱七",
        password: "111111",
        phone: "13800000009",
        role: "测试工程师",
      },
      {
        username: "sunba",
        name: "孙八",
        password: "111111",
        phone: "13800000010",
        role: "后端开发",
      },
      {
        username: "zhoujiu",
        name: "周小九",
        password: "111111",
        phone: "13800000011",
        role: "前端开发",
      },
      {
        username: "wushi",
        name: "吴十",
        password: "111111",
        phone: "13800000012",
        role: "人事专员",
      },
      {
        username: "zhengsy",
        name: "郑十一",
        password: "111111",
        phone: "13800000013",
        role: "财务出纳",
      },
      {
        username: "fengse",
        name: "冯十二",
        password: "111111",
        phone: "13800000014",
        role: "项目经理",
      },
      {
        username: "chenss",
        name: "陈十三",
        password: "111111",
        phone: "13800000015",
        role: "运维主管",
      },
      {
        username: "chuss",
        name: "褚十四",
        password: "111111",
        phone: "13800000016",
        role: "前端、产品",
      },
      {
        username: "weish",
        name: "卫十五",
        password: "111111",
        phone: "13800000017",
        role: "测试、后端",
      },
      {
        username: "jiangsh",
        name: "蒋十六",
        password: "111111",
        phone: "13800000018",
        role: "行政文员",
      },
      {
        username: "shensh",
        name: "沈十七",
        password: "111111",
        phone: "13800000019",
        role: "数据分析师",
      },
      {
        username: "hansh",
        name: "韩十八",
        password: "111111",
        phone: "13800000020",
        role: "Java后端",
      },
      {
        username: "yangsh",
        name: "杨十九",
        password: "111111",
        phone: "13800000021",
        role: "Vue前端",
      },
      {
        username: "zhuers",
        name: "朱二十",
        password: "111111",
        phone: "13800000022",
        role: "测试主管",
      },
      {
        username: "qinery",
        name: "秦二一",
        password: "111111",
        phone: "13800000023",
        role: "财务主管",
      },
      {
        username: "youer",
        name: "尤二二",
        password: "111111",
        phone: "13800000024",
        role: "销售专员",
      },
      {
        username: "xuer",
        name: "许二三",
        password: "111111",
        phone: "13800000025",
        role: "客服专员",
      },
      {
        username: "heer",
        name: "何二四",
        password: "111111",
        phone: "13800000026",
        role: "全栈开发",
      },
      {
        username: "lyuer",
        name: "吕二五",
        password: "111111",
        phone: "13800000027",
        role: "产品测试",
      },
      {
        username: "shier",
        name: "施二六",
        password: "111111",
        phone: "13800000028",
        role: "后端、运维",
      },
      {
        username: "zhaner",
        name: "张二七",
        password: "111111",
        phone: "13800000029",
        role: "UI、交互设计",
      },
      {
        username: "konger",
        name: "孔二八",
        password: "111111",
        phone: "13800000030",
        role: "实习生、测试",
      },
    ];
    const values = employees.map((e) => [
      e.username,
      e.name,
      e.password,
      e.phone,
      e.role,
    ]);
    await emppool.query(
      "INSERT INTO employee (username, name, password, phone, role) VALUES ?",
      [values]
    );
    console.log("✅ 员工数据（30条）初始化完成");
  }

  console.log("🎉 所有数据初始化完成，服务可以正常使用了！");
}

// 启动服务
app.listen(port,'0.0.0.0',async () => {
  await initAllData();
  console.log(`\n✅ 企业级后端服务已启动：http://0.0.0.0:${port}`);
  console.log("📌 测试地址（和原JSON版完全一致）：");
  console.log(
    "   品牌列表：http://localhost:8889/admin/product/baseTrademark/1/10"
  );
  console.log(
    "   一级分类：http://localhost:8889/admin/product/category/list/tree"
  );
  console.log(
    "   手机分类属性：http://localhost:8889/admin/product/attr/list/1011"
  );
  console.log("   员工列表：http://localhost:8889/admin/acl/user/1/5");
  console.log("   角色列表：http://localhost:8889/admin/acl/role/1/5");
});
