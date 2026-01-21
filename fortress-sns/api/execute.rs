use vercel_runtime::{run, Body, Error, Request, Response, StatusCode};
use serde_json::json;
use reqwest::Client;

#[tokio::main]
async fn main() -> Result<(), Error> {
    run(handler).await
}

pub async fn handler(req: Request) -> Result<Response<Body>, Error> {
    let api_key = std::env::var("GEMINI_API_KEY").unwrap_or_default();
    let body_bytes = req.body();
    let body_str = std::str::from_utf8(body_bytes).unwrap_or("{}");
    let json_body: serde_json::Value = serde_json::from_str(body_str).unwrap_or(json!({}));
    let content = json_body["content"].as_str().unwrap_or("...");

    let client = Client::new();
    let url = format!("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key={}", api_key);
    
    let gemini_req = json!({
        "contents": [{"parts": [{"text": format!("あなたは要塞のSNS番人です。以下の投稿を解析し、2026年基準の判決を下せ: {}", content)}]}]
    });

    let res = client.post(url).json(&gemini_req).send().await?;
    let res_json: serde_json::Value = res.json().await?;
    let ai_text = res_json["candidates"][0]["content"]["parts"][0]["text"].as_str().unwrap_or("判決不可");

    let response = json!({ 
        "verdict": ai_text, 
        "timestamp": chrono::Utc::now().to_rfc3339(),
        "status": "EXECUTED"
    });

    Ok(Response::builder()
        .status(StatusCode::OK)
        .header("Content-Type", "application/json")
        .body(Body::Text(response.to_string()))?)
}