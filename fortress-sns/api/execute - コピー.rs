use serde::{Deserialize, Serialize};
use serde_json::json;
use vercel_runtime::{run, Body, Error, Request, Response, StatusCode};
use reqwest::Client;

#[derive(Deserialize)]
struct IncomingRequest {
    content: String,
}

#[derive(Serialize)]
struct GeminiResponse {
    candidates: Vec<Candidate>,
}

#[derive(Serialize, Deserialize)]
struct Candidate {
    content: Content,
}

#[derive(Serialize, Deserialize)]
struct Content {
    parts: Vec<Part>,
}

#[derive(Serialize, Deserialize)]
struct Part {
    text: String,
}

#[tokio::main]
async fn main() -> Result<(), Error> {
    run(handler).await
}

pub async fn handler(req: Request) -> Result<Response<Body>, Error> {
    // 1. メソッドチェック
    if req.method() != "POST" {
        return Ok(Response::builder()
            .status(StatusCode::METHOD_NOT_ALLOWED)
            .body(Body::Text("POSTのみ受け付けます".into()))?);
    }

    // 2. リクエストボディの解析
    let body = req.body();
    let body_str = std::str::from_utf8(body).map_err(|_| Error::from("Invalid UTF-8"))?;
    let incoming: IncomingRequest = serde_json::from_str(body_str).unwrap_or(IncomingRequest {
        content: "内容なし".to_string(),
    });

    // 3. Gemini API 呼び出し (環境変数からAPIキー取得)
    let api_key = std::env::var("GEMINI_API_KEY").unwrap_or_default();
    let client = Client::new();
    let gemini_url = format!(
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key={}",
        api_key
    );

    let gemini_payload = json!({
        "contents": [{
            "parts": [{
                "text": format!("あなたは要塞の番人です。以下の投稿を検閲し、適切な返答をしてください: {}", incoming.content)
            }]
        }]
    });

    let res = client.post(gemini_url)
        .json(&gemini_payload)
        .send()
        .await
        .map_err(|e| Error::from(format!("Gemini通信エラー: {}", e)))?;

    let gemini_data: serde_json::Value = res.json().await.unwrap_or(json!({}));

    // 4. レスポンスの構築
    let ai_text = gemini_data["candidates"][0]["content"]["parts"][0]["text"]
        .as_str()
        .unwrap_or("判決不能");

    let response_data = json!({
        "status": "VALIDATED",
        "verdict": ai_text,
        "timestamp": chrono::Utc::now().to_rfc3339()
    });

    Ok(Response::builder()
        .status(StatusCode::OK)
        .header("Content-Type", "application/json")
        .body(Body::Text(response_data.to_string()))?)
}