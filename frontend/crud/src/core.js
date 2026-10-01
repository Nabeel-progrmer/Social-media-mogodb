const productionApiUrl = "https://social-media-mogodb.vercel.app";
const localApiUrl = "http://localhost:5002";

export const baseUrl = (
	import.meta.env.VITE_API_URL ||
	(import.meta.env.PROD ? productionApiUrl : localApiUrl)
).replace(/\/+$/, "");
