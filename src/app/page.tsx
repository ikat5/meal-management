import { redirect } from "next/navigation";

/**
 * The root URL just forwards to the dashboard.
 * (Middleware already redirects logged-out visitors to /login.)
 */
export default function Home() {
  redirect("/dashboard");
}
