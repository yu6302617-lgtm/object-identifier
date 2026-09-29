export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      error: "只支持 POST 请求"
    });
  }

  try {
    const { image } = req.body || {};

    if (!image) {
      return res.status(400).json({
        success: false,
        error: "没有收到图片"
      });
    }

    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        success: false,
        error: "服务器还没有配置 OPENAI_API_KEY"
      });
    }

    const response = await fetch(
      "https://api.openai.com/v1/responses",
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "gpt-5.6-luna",
          input: [
            {
              role: "user",
              content: [
                {
                  type: "input_text",
                  text: `请识别这张生活照片中的常见物品。

只返回 JSON，不要 Markdown。

格式：
{
  "items": [
    {
      "name": "物品中文名",
      "category": "类别",
      "confidence": 95,
      "usage": "主要用途",
      "description": "简短介绍"
    }
  ]
}

要求：
1. 最多识别 8 个物品。
2. confidence 必须是 0 到 100 的整数。
3. 只返回比较可靠的识别结果。
4. 使用中文。
5. 不识别人脸、个人身份、车牌等个人信息。`
                },
                {
                  type: "input_image",
                  image_url: `data:image/jpeg;base64,${image}`
                }
              ]
            }
          ]
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        success: false,
        error: data?.error?.message || "AI 接口请求失败"
      });
    }

    const text =
      data.output_text ||
      data.output
        ?.flatMap(item => item.content || [])
        .filter(item => item.type === "output_text")
        .map(item => item.text)
        .join("") ||
      "";

    const clean = text
      .replace(/^```json\s*/i, "")
      .replace(/```\s*$/i, "")
      .trim();

    const parsed = JSON.parse(clean);

    const results = Array.isArray(parsed.items)
      ? parsed.items.map(item => ({
          name: String(item.name || "未知物品"),
          category: String(item.category || "其他"),
          confidence: Math.max(
            0,
            Math.min(100, Number(item.confidence) || 0)
          ),
          usage: String(item.usage || ""),
          description: String(item.description || "")
        }))
      : [];

    return res.status(200).json({
      success: true,
      results
    });

  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      error: error.message || "服务器错误"
    });
  }
}
