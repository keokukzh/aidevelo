export async function onRequest({ request, next, params }) {
  const path = params.path || "";
  const url = new URL(request.url);

  // Proxy to Render backend
  const backendUrl = `https://aidevelo.onrender.com/${path}${url.search}`;

  const headers = new Headers(request.headers);
  headers.set("Host", "aidevelo.onrender.com");

  const response = await fetch(backendUrl, {
    method: request.method,
    headers,
    body: request.body,
    redirect: "follow",
  });

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
}
