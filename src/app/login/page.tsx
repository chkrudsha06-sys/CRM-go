"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getCurrentUser, login } from "@/lib/auth";
import styles from "./login.module.css";

export default function LoginPage() {
  const router = useRouter();
  const [userId, setUserId] = useState("");
  const [userPw, setUserPw] = useState("");
  const [remember, setRemember] = useState(true);
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const user = getCurrentUser();
    if (user) router.replace("/");
  }, [router]);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;

    const id = userId.trim();
    const password = userPw.trim();

    if (!id || !password) {
      setError("아이디와 비밀번호를 입력해주세요.");
      return;
    }

    setLoading(true);
    setError("");

    const user = await login(id, password);

    if (user) {
      if (!remember && typeof window !== "undefined") {
        sessionStorage.setItem("crm_user_once", JSON.stringify(user));
      }
      router.replace("/");
      return;
    }

    setError("아이디 또는 비밀번호가 올바르지 않습니다.");
    setLoading(false);
  }

  return (
    <main className={styles.page}>
      <div className={styles.frame}>
        <section className={styles.formSide}>
          <form className={styles.formInner} onSubmit={handleLogin}>
            <div className={styles.logo}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/company-logo.png" alt="광고인" className={styles.logoImage} />
              <div>
                <p className={styles.logoTitle}>분양회 CRM</p>
                <p className={styles.logoSub}>광고인㈜ 대외협력팀</p>
              </div>
            </div>

            <h1 className={styles.title}>다시 오셨군요!</h1>
            <p className={styles.subtitle}>분양의신 CRM 계정 정보를 입력해주세요.</p>

            <label className={styles.label} htmlFor="userId">
              아이디
            </label>
            <input
              className={styles.input}
              id="userId"
              type="text"
              autoComplete="username"
              value={userId}
              onChange={(event) => {
                setUserId(event.target.value);
                setError("");
              }}
              placeholder="아이디를 입력하세요"
              required
            />

            <label className={styles.label} htmlFor="userPw">
              비밀번호
            </label>
            <div className={styles.passwordWrap}>
              <input
                className={`${styles.input} ${styles.passwordInput}`}
                id="userPw"
                type={showPw ? "text" : "password"}
                autoComplete="current-password"
                value={userPw}
                onChange={(event) => {
                  setUserPw(event.target.value);
                  setError("");
                }}
                placeholder="비밀번호를 입력하세요"
                required
              />
              <button
                className={styles.passwordToggle}
                type="button"
                onClick={() => setShowPw((prev) => !prev)}
                aria-label={showPw ? "비밀번호 숨기기" : "비밀번호 보기"}
              >
                {showPw ? "숨기기" : "보기"}
              </button>
            </div>

            <div className={styles.row}>
              <label className={styles.remember}>
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(event) => setRemember(event.target.checked)}
                />
                로그인 상태 유지
              </label>
              <span className={styles.forgot}>관리자 문의</span>
            </div>

            <button className={styles.loginBtn} type="submit" disabled={loading}>
              {loading ? "로그인 중..." : "로그인"}
              <svg
                className={styles.arrow}
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </button>

            {error && <p className={styles.errorMsg}>{error}</p>}

            <div className={styles.noticeBox}>
              <p>카카오워크 알림, 고객관리, 영업활동, 매출관리, KPI 분석을 하나의 CRM에서 운영합니다.</p>
            </div>

            <p className={styles.signup}>계정 발급 및 비밀번호 변경은 관리자에게 문의해주세요.</p>
          </form>
        </section>

        <section className={styles.visualSide}>
          <div className={styles.glassCard}>
            <div className={styles.bgDeco}>
              <div className={styles.v1} />
              <div className={styles.v2} />
              <div className={styles.v3} />
              <div className={styles.h1Line} />
              <div className={styles.h2Line} />
              <div className={`${styles.cloud} ${styles.cloudA}`} />
              <div className={`${styles.cloud} ${styles.cloudB}`} />
            </div>

            <div className={styles.lamp}>
              <div className={styles.cord} />
              <div className={styles.shade} />
              <div className={styles.light} />
            </div>

            <div className={styles.heroImgWrap}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className={styles.heroImg} src="/character.webp" alt="CRM 업무 캐릭터" />
            </div>

            <div className={styles.caption}>
              <p className={styles.captionBadge}>BUNYANGHOE CRM</p>
              <h2>끊김 없는 영업관리</h2>
              <p>고객DB, VIP활동, 파이프라인, 매출관리까지 하나의 대시보드에서 관리하세요.</p>
              <div className={styles.dots}>
                <span className={styles.active} />
                <span />
                <span />
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
