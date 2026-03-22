# dpaste-worker

一个基于 Cloudflare Workers 的轻量级、自托管文本/代码存储 API 服务

## 🌟 功能特性

- **极简接口**：仅需一个 POST 请求即可完成内容上传
- **过期控制**：支持自定义过期时间（秒），默认永久保存
- **容量限制**：默认支持最大 **1MB** 的内容上传（可自定义）
- **安全验证**：支持通过 `AUTH` 环境变量设置 `Bearer Token` 鉴权
- **即时访问**：上传成功后返回短链接标识符，通过根目录直接访问原始文本

---

## 🛠 接口文档

### 1. 创建内容 (POST)

**请求 URL:** `https://your-domain.com/api/v1/`  
**Content-Type:** `application/x-www-form-urlencoded`

#### 请求参数 (Body)

| 参数名 | 类型 | 必选 | 说明 |
| :---: | :---: | :---: | :---: |
| **`content`** | string | **是** | 需要存储的文本内容 |
| **`expire`** | number | 否 | 过期时间（秒）如果不提供，内容将永久保存 |

#### 请求头 (Headers)

如果在环境变量中配置了 `AUTH`，则必须包含：
- `Authorization: Bearer <你的AUTH值>`

#### 响应结果
成功后返回 `201 OK`，返回值为随机生成的字符串 ID（例如：`abc123XYZ`）

---

### 2. 访问内容 (GET)

**请求 URL:** `https://your-domain.com/<随机字符串>`

通过 GET 请求直接访问返回的 ID，即可获取对应的原始文本内容

---

## 💻 示例代码 (cURL)

### 基础上传（永久存储）
```bash
curl -X POST https://your-domain.com/api/v1/ \
     -d "content=Hello dpaste-worker!"
```

---

### 带有过期时间的上传（60秒后过期）
```bash
curl -X POST https://your-domain.com/api/v1/ \
     -d "content=这是一条临时消息" \
     -d "expire=60"
```

---

### 带 Token 验证的上传
```bash
curl -X POST https://your-domain.com/api/v1/ \
     -H "Authorization: Bearer 6f21b759226944aadc4509fe6233f818" \
     -d "content=数据"
```

---

## ⚙️ 环境变量配置
请在 Cloudflare Workers 控制面板的 **Settings -> Variables** 中配置以下变量：
| 环境变量名 | 对应内部变量 | 默认值 | 说明 |
| :---: | :---: | :---: | :---: |
| **`AUTH`** | `AUTHORIZATION` | (空) | **访问令牌** 设置后，请求头必须匹配 `Bearer <AUTH>` |
| **`MAX_SIZE`** | `MAX_DATA_SIZE` | `1048576` | 最大上传字节数 (1MB = 1048576) |
| **`DIGITS_LEN`** | `DIGIT_COUNT` | `4` | 生成 ID 时包含的数字位数 |
| **`ID_LEN`** | `RANDOM_LENGTH` | `12` | 生成的随机 ID 字符串总长度（最大为18 最小为5） |

---

## 📄 开源协议
MIT License
