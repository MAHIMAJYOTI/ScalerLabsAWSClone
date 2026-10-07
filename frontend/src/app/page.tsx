import { redirect } from "next/navigation";

// The proxy normally handles "/" (cookie-aware); this is the fallback.
export default function Home() {
  redirect("/route53/v2/hostedzones");
}
