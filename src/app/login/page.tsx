"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getCurrentUser, login } from "@/lib/auth";

const metrics = [
  { label: "오늘 신규 VIP 고객", value: "24명", trend: "+18%" },
  { label: "상담 진행중", value: "138건", trend: "+32" },
  { label: "미팅 확정", value: "17건", trend: "+6" },
  { label: "예상 매출", value: "4.8억", trend: "+12%" },
];

const flowItems = [
  "VIP 고객 등록",
  "카카오워크 알림",
  "담당자 자동 배정",
];

export default function LoginPage() {
  const router = useRouter();
  const [userId, setUserId] = useState("");
  const [userPw, setUserPw] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const user = getCurrentUser();
    if (user) router.push("/");
  }, [router]);

  const handleLogin = async () => {
    if (loading) return;

    if (!userId.trim() || !userPw.trim()) {
      setError("아이디와 비밀번호를 입력해주세요.");
      return;
    }

    setLoading(true);
    setError("");

    const user = await login(userId.trim(), userPw);

    if (user) {
      router.push("/");
      return;
    }

    setError("아이디 또는 비밀번호가 올바르지 않습니다.");
    setLoading(false);
  };

  return (
    <main className="min-h-screen overflow-hidden bg-[#f7f8fb] text-slate-950">
      <section className="grid min-h-screen grid-cols-1 lg:grid-cols-[1.58fr_1fr]">
        <aside className="relative hidden min-h-screen overflow-hidden bg-[#050816] px-12 py-10 text-white lg:flex lg:flex-col lg:justify-between xl:px-16">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(6,182,212,0.3),transparent_30%),radial-gradient(circle_at_80%_16%,rgba(124,58,237,0.36),transparent_34%),radial-gradient(circle_at_68%_84%,rgba(79,70,229,0.3),transparent_36%),linear-gradient(135deg,#020617_0%,#0f172a_46%,#312e81_100%)]" />
          <div className="absolute inset-0 opacity-[0.17] [background-image:linear-gradient(rgba(255,255,255,0.12)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.12)_1px,transparent_1px)] [background-size:56px_56px]" />
          <div className="absolute -left-24 top-20 h-72 w-72 rounded-full bg-cyan-400/20 blur-3xl" />
          <div className="absolute bottom-8 right-6 h-96 w-96 rounded-full bg-violet-500/20 blur-3xl" />

          <svg className="absolute inset-0 h-full w-full opacity-35" aria-hidden="true">
            <defs>
              <linearGradient id="loginLineGradient" x1="0" x2="1" y1="0" y2="1">
                <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.1" />
                <stop offset="50%" stopColor="#818cf8" stopOpacity="0.55" />
                <stop offset="100%" stopColor="#a78bfa" stopOpacity="0.15" />
              </linearGradient>
            </defs>
            <path
              d="M70 190 C260 95, 420 280, 625 158 S930 132, 1090 268"
              fill="none"
              stroke="url(#loginLineGradient)"
              strokeWidth="1.3"
            />
            <path
              d="M40 558 C245 438, 380 652, 585 530 S860 388, 1068 522"
              fill="none"
              stroke="url(#loginLineGradient)"
              strokeWidth="1.1"
            />
            <path
              d="M160 760 C332 660, 562 830, 762 690 S982 638, 1160 780"
              fill="none"
              stroke="url(#loginLineGradient)"
              strokeWidth="1.1"
            />
            {[120, 280, 460, 640, 820, 1000].map((cx, index) => (
              <circle
                key={cx}
                cx={cx}
                cy={index % 2 === 0 ? 190 : 530}
                r="4"
                fill="#67e8f9"
                opacity="0.7"
              />
            ))}
          </svg>

          <div className="relative z-10 flex items-center justify-between">
            <div className="flex items-center gap-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/company-logo.png"
                alt="광고인"
                className="h-9 w-auto object-contain"
                onError={(event) => {
                  event.currentTarget.style.display = "none";
                }}
              />
              <div className="h-7 w-px bg-white/15" />
              <div>
                <p className="text-sm font-semibold tracking-[0.3em] text-cyan-200/90">
                  ADPERSON CRM
                </p>
                <p className="mt-2 text-sm text-white/50">Daehyup Team Workspace</p>
              </div>
            </div>

            <div className="rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm text-white/70 shadow-2xl backdrop-blur-xl">
              VIP Customer Platform
            </div>
          </div>

          <div className="relative z-10 max-w-3xl">
            <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm text-cyan-100 shadow-2xl backdrop-blur-xl">
              <span className="h-2 w-2 rounded-full bg-cyan-300 shadow-[0_0_18px_rgba(103,232,249,0.9)]" />
              실시간 고객 · 영업 · 성과관리
            </div>

            <h1 className="max-w-2xl text-6xl font-black leading-[1.05] tracking-[-0.06em] xl:text-7xl">
              성과를 만드는 CRM
            </h1>
            <p className="mt-7 max-w-xl text-2xl font-semibold leading-relaxed tracking-[-0.03em] text-white/82">
              VIP 고객을 하나의 플랫폼에서 관리하세요.
            </p>
            <p className="mt-5 max-w-2xl text-base leading-8 text-slate-300/80">
              고객관리, 영업활동, 광고운영, 성과분석을 하나의 플랫폼에서 통합 관리합니다.
            </p>

            <div className="mt-12 grid max-w-3xl grid-cols-2 gap-4">
              {metrics.map((item) => (
                <div
                  key={item.label}
                  className="rounded-3xl border border-white/10 bg-white/[0.08] p-5 shadow-2xl backdrop-blur-2xl transition duration-300 hover:-translate-y-1 hover:bg-white/[0.12]"
                >
                  <div className="flex items-center justify-between gap-4">
                    <p className="text-sm text-slate-300">{item.label}</p>
                    <span className="rounded-full bg-cyan-300/10 px-2.5 py-1 text-xs font-bold text-cyan-200">
                      {item.trend}
                    </span>
                  </div>
                  <p className="mt-4 text-3xl font-black tracking-[-0.04em] text-white">
                    {item.value}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="relative z-10 grid grid-cols-3 gap-3">
            {flowItems.map((item, index) => (
              <div
                key={item}
                className="rounded-2xl border border-white/10 bg-white/[0.06] p-4 backdrop-blur-xl"
              >
                <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-sm font-black text-cyan-100">
                  {index + 1}
                </div>
                <p className="text-sm font-semibold text-white/75">{item}</p>
              </div>
            ))}
          </div>
        </aside>

        <section className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_top_right,rgba(79,70,229,0.1),transparent_30%),linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] px-6 py-10">
          <div className="absolute right-[-140px] top-[-140px] h-80 w-80 rounded-full bg-indigo-500/10 blur-3xl" />
          <div className="absolute bottom-[-170px] left-[-170px] h-96 w-96 rounded-full bg-cyan-500/10 blur-3xl" />

          <div className="relative z-10 w-full max-w-[460px]">
            <div className="mb-10 lg:hidden">
              <p className="text-sm font-black tracking-[0.28em] text-indigo-600">
                ADPERSON CRM
              </p>
              <h1 className="mt-5 text-4xl font-black tracking-[-0.05em] text-slate-950">
                성과를 만드는 CRM
              </h1>
              <p className="mt-3 text-base font-medium text-slate-500">
                VIP 고객을 하나의 플랫폼에서 관리하세요.
              </p>
            </div>

            <div className="mb-10 hidden lg:block">
              <p className="text-sm font-black tracking-[0.28em] text-indigo-600">
                ADPERSON CRM
              </p>
              <h2 className="mt-6 text-4xl font-black tracking-[-0.05em] text-slate-950">
                환영합니다.
              </h2>
              <p className="mt-4 text-base leading-7 text-slate-500">
                계정에 로그인하여 오늘의 업무를 시작하세요.
              </p>
            </div>

            <form
              className="rounded-[2rem] border border-slate-200/80 bg-white/85 p-7 shadow-[0_24px_80px_rgba(15,23,42,0.08)] backdrop-blur-2xl"
              onSubmit={(event) => {
                event.preventDefault();
                handleLogin();
              }}
            >
              <label className="block">
                <span className="text-sm font-bold text-slate-700">아이디</span>
                <input
                  type="text"
                  value={userId}
                  onChange={(event) => {
                    setUserId(event.target.value);
                    setError("");
                  }}
                  placeholder="아이디를 입력하세요"
                  autoComplete="username"
                  className="mt-2 h-14 w-full rounded-2xl border border-slate-200 bg-white px-4 text-[15px] font-semibold text-slate-900 outline-none transition placeholder:font-medium placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10"
                />
              </label>

              <label className="mt-5 block">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-slate-700">비밀번호</span>
                  <button
                    type="button"
                    onClick={() => setShowPw((prev) => !prev)}
                    className="text-sm font-bold text-indigo-600 transition hover:text-indigo-700"
                  >
                    {showPw ? "숨기기" : "보기"}
                  </button>
                </div>

                <input
                  type={showPw ? "text" : "password"}
                  value={userPw}
                  onChange={(event) => {
                    setUserPw(event.target.value);
                    setError("");
                  }}
                  placeholder="비밀번호를 입력하세요"
                  autoComplete="current-password"
                  className="mt-2 h-14 w-full rounded-2xl border border-slate-200 bg-white px-4 text-[15px] font-semibold text-slate-900 outline-none transition placeholder:font-medium placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10"
                />
              </label>

              {error && (
                <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold leading-6 text-rose-600">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="mt-7 h-14 w-full rounded-2xl bg-slate-950 text-base font-black text-white shadow-[0_18px_40px_rgba(15,23,42,0.22)] transition duration-300 hover:-translate-y-0.5 hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0 disabled:hover:bg-slate-950"
              >
                {loading ? "로그인 중..." : "로그인"}
              </button>

              <div className="mt-6 rounded-2xl bg-slate-50 px-4 py-4">
                <p className="text-sm leading-6 text-slate-500">
                  카카오워크 연동, VIP 고객관리, 영업활동 기록, 성과분석 기능은 관리자 권한 기준으로 순차 제공됩니다.
                </p>
              </div>
            </form>

            <p className="mt-8 text-center text-xs font-medium text-slate-400">
              © 2026 ADPERSON CRM. Built for Daehyup Team.
            </p>
          </div>
        </section>
      </section>
    </main>
  );
}
