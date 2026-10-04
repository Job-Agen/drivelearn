import { LoginForm } from "./form";

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { ok } = await searchParams;
  return (
    <main className="login">
      <LoginForm notice={typeof ok === "string" ? ok : null} />
    </main>
  );
}
