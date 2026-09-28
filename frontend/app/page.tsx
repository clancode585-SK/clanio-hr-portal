import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import HomeContent from "@/components/home/HomeContent";

export default async function Home() {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;
  const auth = cookieStore.get("isAuthenticated")?.value;

  if (!token && auth !== "true") {
    redirect("/login");
  }

  return <HomeContent />;
}
