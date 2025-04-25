# Supabase 指南

本文档提供了 Supabase 的基本概念、配置和操作指南，特别关注数据库迁移和项目管理。

## 目录

1. [Supabase 简介](#1-supabase-简介)
2. [项目配置](#2-项目配置)
3. [数据库迁移](#3-数据库迁移)
4. [本地开发环境](#4-本地开发环境)
5. [远程项目管理](#5-远程项目管理)
6. [常见问题与解决方案](#6-常见问题与解决方案)
7. [最佳实践](#7-最佳实践)

## 1. Supabase 简介

Supabase 是一个开源的 Firebase 替代品，提供了以下核心功能：

- **PostgreSQL 数据库**：功能强大的关系型数据库
- **身份验证**：内置用户管理和多种身份验证方法
- **实时订阅**：通过 WebSockets 实时更新数据
- **存储**：文件存储和管理
- **边缘函数**：在全球边缘网络上运行代码
- **向量搜索**：AI 应用的向量嵌入和搜索

Supabase 可以部署在云端（Supabase 平台）或自托管环境中。

## 2. 项目配置

### 2.1 配置文件

Supabase 项目的主要配置文件是 `supabase/config.toml`，它定义了项目的各种设置：

```toml
# 数据库配置
[db]
port = 5432
shadow_port = 5433

# API 配置
[api]
port = 54321
schemas = ["public", "storage", "graphql_public"]

# 身份验证配置
[auth]
site_url = "http://localhost:3000"
additional_redirect_urls = []
jwt_expiry = 3600
```

### 2.2 配置管理

- **本地与远程配置**：本地配置（`supabase/config.toml`）可能与远程项目配置不同
- **配置同步**：使用 `supabase db pull` 从远程项目拉取配置
- **环境特定配置**：可以为不同环境（开发、测试、生产）创建不同的配置文件

### 2.3 版本控制

建议将以下 Supabase 相关文件纳入版本控制：
- `supabase/migrations/` - 数据库迁移文件
- `supabase/config.toml` - 项目配置
- `supabase/seed.sql` - 初始数据（如果有）

可以将以下内容添加到 `.gitignore`：
```
# Supabase
.supabase
supabase/.temp
```

## 3. 数据库迁移

### 3.1 迁移文件

迁移文件是 SQL 脚本，用于对数据库结构进行版本控制和变更管理。它们通常放在 `supabase/migrations` 目录下，按时间戳命名：

```
supabase/migrations/
  ├── 20230101000000_initial_schema.sql
  ├── 20230201000000_add_users_table.sql
  └── 20230301000000_add_posts_table.sql
```

### 3.2 创建迁移文件

手动创建迁移文件：

```bash
# 创建迁移目录（如果不存在）
mkdir -p supabase/migrations

# 创建迁移文件
touch supabase/migrations/$(date +%Y%m%d%H%M%S)_my_migration.sql
```

### 3.3 迁移文件示例

以下是一个添加表和字段的迁移文件示例：

```sql
-- 添加新字段到现有表
ALTER TABLE chat_messages
ADD COLUMN IF NOT EXISTS is_visible BOOLEAN DEFAULT TRUE NOT NULL;

-- 创建新表
CREATE TABLE IF NOT EXISTS pregenerated_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  hidden_message TEXT NOT NULL,
  ai_response TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  used_at TIMESTAMPTZ,
  is_used BOOLEAN DEFAULT FALSE
);

-- 创建索引
CREATE INDEX IF NOT EXISTS pregenerated_messages_user_id_idx 
ON pregenerated_messages(user_id);
```

### 3.4 执行迁移

#### 本地环境

```bash
# 启动本地 Supabase 实例
supabase start

# 应用迁移
supabase db push
```

#### 远程项目

```bash
# 链接到远程项目
supabase link --project-ref <project-id>

# 应用迁移
supabase db push
```

#### 使用 Supabase Dashboard

1. 登录 [Supabase Dashboard](https://app.supabase.io/)
2. 选择项目
3. 点击 "SQL Editor"
4. 粘贴迁移 SQL 并执行

### 3.5 迁移最佳实践

- **幂等性**：编写可以多次执行而不产生错误的迁移脚本
- **原子性**：使用事务包装相关更改，确保全部成功或全部失败
- **向后兼容**：尽量避免破坏性更改
- **测试**：在应用到生产环境前，先在测试环境验证迁移
- **备份**：执行迁移前备份数据库

## 4. 本地开发环境

### 4.1 安装 Supabase CLI

```
brew install supabase/tap/supabase
```

### 4.2 初始化项目

```bash
# 创建新项目
supabase init

# 或在现有项目中初始化
cd my-project
supabase init
```

### 4.3 启动本地开发环境

```bash
supabase start
```

这将启动本地 PostgreSQL 数据库、Auth 服务、Storage 服务和 API 服务。

### 4.4 停止本地环境

```bash
supabase stop
```

### 4.5 重置本地数据库

```bash
supabase db reset
```

## 5. 远程项目管理

### 5.1 创建远程项目

1. 登录 [Supabase Dashboard](https://app.supabase.io/)
2. 点击 "New Project"
3. 填写项目详情并创建

### 5.2 链接本地项目到远程

```bash
supabase link --project-ref <project-id>
```

项目 ID 可以在 Supabase Dashboard 的项目设置中找到。

### 5.3 从远程拉取架构

```bash
supabase db pull
```

这将从远程项目拉取数据库架构和配置。

### 5.4 推送迁移到远程

```bash
supabase db push
```

这将应用本地迁移文件到远程项目。

### 5.5 管理远程数据

使用 Supabase Dashboard：
1. 登录 Dashboard
2. 选择项目
3. 使用 "Table Editor" 或 "SQL Editor" 管理数据

## 6. 常见问题与解决方案

### 6.1 连接问题

**问题**：无法连接到远程数据库
```
failed to connect to postgres: failed to connect to `host=db.xxx.supabase.co user=postgres database=postgres`
```

**解决方案**：
- 检查网络连接和防火墙设置
- 验证项目 ID 和凭据是否正确
- 使用 Supabase Dashboard 的 SQL 编辑器作为替代方案

### 6.2 配置差异警告

**问题**：本地配置与远程配置不同
```
WARNING: Local config differs from linked project. Try updating supabase/config.toml
```

**解决方案**：
- 使用 `supabase db pull` 更新本地配置
- 或手动编辑 `supabase/config.toml` 解决差异

### 6.3 迁移失败

**问题**：数据库迁移失败
```
ERROR: relation "xxx" already exists
```

**解决方案**：
- 使用 `IF NOT EXISTS` 子句使迁移幂等
- 检查迁移文件中的语法错误
- 确认用户有执行迁移所需的权限

### 6.4 本地环境问题

**问题**：本地 Supabase 实例启动失败

**解决方案**：
- 确保 Docker 正在运行
- 检查端口冲突
- 尝试重置：`supabase stop && supabase start`

## 7. 最佳实践

### 7.1 项目结构

推荐的项目结构：
```
my-project/
  ├── supabase/
  │   ├── migrations/       # 数据库迁移文件
  │   ├── functions/        # 边缘函数
  │   ├── seed.sql          # 初始数据
  │   └── config.toml       # 项目配置
  ├── src/                  # 应用源代码
  ├── .gitignore
  └── package.json
```

### 7.2 数据库设计

- **行级安全策略**：为所有表启用 RLS，确保数据安全
- **外键约束**：使用外键维护数据完整性
- **索引**：为经常查询的列创建索引
- **类型**：利用 PostgreSQL 的丰富类型系统

### 7.3 身份验证

- **JWT 过期时间**：根据安全需求设置合适的 JWT 过期时间
- **重定向 URL**：仅允许受信任的重定向 URL
- **MFA**：考虑启用多因素认证增强安全性

### 7.4 部署流程

推荐的部署流程：
1. 在开发环境创建和测试迁移
2. 在测试环境验证迁移
3. 在部署前备份生产数据库
4. 应用迁移到生产环境
5. 验证部署是否成功

### 7.5 监控和维护

- 定期备份数据库
- 监控数据库性能和资源使用
- 定期审查和优化查询
- 保持 Supabase 客户端库更新到最新版本

## 结论

Supabase 提供了强大而灵活的后端服务，适合各种规模的应用程序。通过正确管理配置和迁移，可以实现高效的开发流程和可靠的部署。本指南涵盖了基本概念和操作，但 Supabase 还有许多高级功能值得探索，如实时订阅、存储管理和边缘函数。
