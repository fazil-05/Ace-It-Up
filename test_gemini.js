const res = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
  method: "POST",
  headers: {
    Authorization: "Bearer AIzaSyCC4SKHpw6gxWQL7jnbevIgUdaPSQ_9vjo",
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    model: "gemini-2.0-flash",
    messages: [{ role: "user", content: "Hello" }]
  })
});
console.log(res.status, await res.text());
