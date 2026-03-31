export async function onRequest(context) {
  const url = new URL(context.request.url);
  const path = url.pathname.replace(/^\/api/, '');
  const backendPath = path === '/api' ? '/' : path;

  const response = await fetch(`https://aidevelo.onrender.com${backendPath}${url.search}`, {
    method: context.request.method,
    headers: {
      ...Object.fromEntries(context.request.headers),
      'Host': 'aidevelo.onrender.com'
    },
    body: context.request.body,
    redirect: 'follow'
  });

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers
  });
}
