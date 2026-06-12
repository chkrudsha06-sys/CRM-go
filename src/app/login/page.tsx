"use client";

import { useState, useEffect, useRef, FormEvent } from "react";
import { useRouter } from "next/navigation";
import styles from "./login.module.css";

// ─────────────────────────────────────────────
// 분양의신 CRM 로그인 페이지
// 경로: app/login/page.tsx
// 영상: public/login-video.mp4 (없으면 안내 화면 표시)
// ─────────────────────────────────────────────

// 캐러셀 문구 — 여기서만 수정하면 됩니다
const SLIDES = [
  {
    title: "Where Ideas Flow",
    desc: "AI 기반 워크스페이스에서 아이디어가 기획부터 실행까지 자연스럽게 흐릅니다.",
  },
  {
    title: "All-in-One CRM",
    desc: "분양 현장의 고객 DB, 파이프라인, 정산까지 하나의 화면에서 관리하세요.",
  },
  {
    title: "Bunyang Universe",
    desc: "분양회 VIP 멤버십과 함께 분양 산업의 새로운 생태계를 만들어갑니다.",
  },
];
const AUTO_INTERVAL = 6000; // 자동 전환 ms, 0이면 끔

const DEPTS = ["광고사업부", "대외협력팀", "TF1", "TF2", "마디1팀", "마디2팀"];

export default function LoginPage() {
  const router = useRouter();

  // ── 로그인 폼 상태 ──
  const [userId, setUserId] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // ── 캐러셀 상태 ──
  const [slide, setSlide] = useState(0);
  const touchX = useRef<number | null>(null);

  // ── 영상 상태 ──
  const [videoReady, setVideoReady] = useState(false);

  // ── 계정요청 모달 상태 ──
  const [modalOpen, setModalOpen] = useState(false);
  const [requestDone, setRequestDone] = useState(false);
  const [showReqPw, setShowReqPw] = useState(false);
  const [req, setReq] = useState({
    name: "",
    dept: "",
    phone: "",
    userId: "",
    password: "",
    reason: "",
  });

  // 캐러셀 자동 전환
  useEffect(() => {
    if (AUTO_INTERVAL <= 0) return;
    const t = setInterval(
      () => setSlide((s) => (s + 1) % SLIDES.length),
      AUTO_INTERVAL
    );
    return () => clearInterval(t);
  }, [slide]);

  // ESC로 모달 닫기
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setModalOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // ── 로그인 처리 ──
  async function handleLogin(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      // ── TODO: 기존 CRM 인증 로직으로 교체 ──
      // ID 기반 로그인이므로 Supabase 사용 시 두 가지 방식 중 택1:
      //
      // (A) users 테이블에서 ID→이메일 매핑 후 signInWithPassword
      // (B) 자체 API 라우트: fetch('/api/login', { method:'POST',
      //       body: JSON.stringify({ userId, password, remember }) })
      //
      // 성공 시: router.push('/dashboard');

      await new Promise((r) => setTimeout(r, 600)); // 데모용
      alert(`로그인 시도: ${userId}${remember ? " (로그인 유지)" : ""}`);
    } catch {
      setError("아이디 또는 비밀번호를 확인해주세요.");
    } finally {
      setLoading(false);
    }
  }

  // ── 계정요청 처리 ──
  async function handleRequest(e: FormEvent) {
    e.preventDefault();
    // ── TODO: 실서비스 연동 ──
    // await fetch('/api/account-request', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify(req),
    // });
    console.log("계정 요청:", req);
    setRequestDone(true);
  }

  function openModal() {
    setReq({ name: "", dept: "", phone: "", userId: "", password: "", reason: "" });
    setRequestDone(false);
    setShowReqPw(false);
    setModalOpen(true);
  }

  const nextSlide = () => setSlide((s) => (s + 1) % SLIDES.length);
  const prevSlide = () => setSlide((s) => (s - 1 + SLIDES.length) % SLIDES.length);

  return (
    <main className={styles.page}>
      <div className={styles.panel}>
        {/* ═════════ 좌측: 영상 + 캐러셀 ═════════ */}
        <section className={styles.mediaSide}>
          <video
            src="/login-video.mp4"
            autoPlay
            muted
            loop
            playsInline
            onLoadedData={() => setVideoReady(true)}
          />

          {!videoReady && (
            <div className={styles.videoPlaceholder}>
              <strong>영상 자리</strong>
              <span>
                프로젝트의 <b>public/login-video.mp4</b> 경로에
                <br />
                영상 파일을 넣으면 자동으로 재생됩니다.
              </span>
            </div>
          )}

          <div className={styles.mediaLogo}>
            {/* 로고: public/wordmark.png */}
            <img className={styles.wordmark} src="/wordmark.png" alt="분양의신" />
            <div className={styles.logoText}>
              <span>(주)광고인</span>
              <span>대외협력팀</span>
            </div>
          </div>

          <div className={styles.mediaShade} />

          {/* 텍스트 캐러셀: 클릭 = 다음, 스와이프 = 좌우 이동 */}
          <div className={styles.captionArea}>
            <div className={styles.captionBars}>
              {SLIDES.map((_, i) => (
                <button
                  key={i}
                  className={i === slide ? styles.barActive : ""}
                  aria-label={`${i + 1}번 문구`}
                  onClick={() => setSlide(i)}
                />
              ))}
            </div>
            <div
              className={styles.captionSlides}
              onClick={nextSlide}
              onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
              onTouchEnd={(e) => {
                if (touchX.current === null) return;
                const dx = e.changedTouches[0].clientX - touchX.current;
                if (Math.abs(dx) > 40) (dx < 0 ? nextSlide() : prevSlide());
                touchX.current = null;
              }}
              title="클릭하면 다음 문구로 넘어갑니다"
            >
              {SLIDES.map((s, i) => (
                <div
                  key={i}
                  className={`${styles.captionSlide} ${
                    i === slide ? styles.slideActive : ""
                  }`}
                >
                  <h2>{s.title}</h2>
                  <p>{s.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ═════════ 우측: 로그인 ═════════ */}
        <section className={styles.formSide}>
          <div className={styles.formInner}>
            <div className={styles.formLogo}>
              {/* 아이콘 로고: public/logo.png */}
              <img src="/logo.png" alt="분양의신 로고" />
            </div>
            <h1 className={styles.formTitle}>다시 오셨군요!</h1>
            <p className={styles.formSub}>분양의신 대외협력팀 CRM 계정으로 로그인하세요</p>

            <form onSubmit={handleLogin}>
              <div className={`${styles.field} ${styles.withIcon}`}>
                <span className={styles.leadIcon}>
                  <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <circle cx="12" cy="8.5" r="3.6" />
                    <path d="M5 19.5c1.4-3.2 4-4.7 7-4.7s5.6 1.5 7 4.7" />
                  </svg>
                </span>
                <input
                  type="text"
                  placeholder="아이디"
                  autoComplete="username"
                  value={userId}
                  onChange={(e) => setUserId(e.target.value)}
                  required
                />
              </div>

              <div className={`${styles.field} ${styles.withIcon}`}>
                <span className={styles.leadIcon}>
                  <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <rect x="4" y="10" width="16" height="10" rx="3" />
                    <path d="M8 10V8a4 4 0 0 1 8 0v2" />
                  </svg>
                </span>
                <input
                  type={showPw ? "text" : "password"}
                  placeholder="비밀번호"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  className={styles.eyeBtn}
                  onClick={() => setShowPw((v) => !v)}
                  aria-label="비밀번호 표시"
                >
                  <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6z" />
                    <circle cx="12" cy="12" r="2.6" />
                  </svg>
                </button>
              </div>

              <div className={styles.row}>
                <label className={styles.remember}>
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                  />
                  로그인 상태 유지
                </label>
              </div>

              <button className={styles.submitBtn} type="submit" disabled={loading}>
                {loading ? "로그인 중..." : "로그인"}
              </button>

              {error && <p className={styles.errorMsg}>{error}</p>}
            </form>

            <div className={styles.divider}>또는</div>

            <button className={styles.requestBtn} onClick={openModal}>
              계정 요청하기
            </button>
          </div>
        </section>
      </div>

      {/* ═════════ 계정요청 모달 ═════════ */}
      {modalOpen && (
        <div
          className={styles.modalOverlay}
          onClick={(e) => {
            if (e.target === e.currentTarget) setModalOpen(false);
          }}
        >
          <div className={styles.modal}>
            {!requestDone ? (
              <div>
                <div className={styles.modalHead}>
                  <h2>계정 요청</h2>
                  <button
                    className={styles.modalClose}
                    onClick={() => setModalOpen(false)}
                    aria-label="닫기"
                  >
                    &times;
                  </button>
                </div>
                <p className={styles.modalDesc}>
                  아래 정보를 입력하시면 관리자 확인 후 계정이 생성됩니다.
                </p>

                <form onSubmit={handleRequest}>
                  <label className={styles.mLabel}>이름</label>
                  <div className={styles.field}>
                    <input
                      type="text"
                      placeholder="이름을 입력하세요"
                      value={req.name}
                      onChange={(e) => setReq({ ...req, name: e.target.value })}
                      required
                    />
                  </div>

                  <label className={styles.mLabel}>부서</label>
                  <div className={styles.field}>
                    <select
                      value={req.dept}
                      onChange={(e) => setReq({ ...req, dept: e.target.value })}
                      className={req.dept === "" ? styles.selectPlaceholder : ""}
                      required
                    >
                      <option value="" disabled hidden>
                        부서를 선택하세요
                      </option>
                      {DEPTS.map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </select>
                  </div>

                  <label className={styles.mLabel}>연락처</label>
                  <div className={styles.field}>
                    <input
                      type="tel"
                      placeholder="010-0000-0000"
                      value={req.phone}
                      onChange={(e) => setReq({ ...req, phone: e.target.value })}
                      required
                    />
                  </div>

                  <label className={styles.mLabel}>사용 ID</label>
                  <div className={styles.field}>
                    <input
                      type="text"
                      placeholder="사용할 아이디를 입력하세요"
                      autoComplete="off"
                      value={req.userId}
                      onChange={(e) => setReq({ ...req, userId: e.target.value })}
                      required
                    />
                  </div>

                  <label className={styles.mLabel}>비밀번호</label>
                  <div className={styles.field}>
                    <input
                      type={showReqPw ? "text" : "password"}
                      placeholder="사용할 비밀번호를 입력하세요"
                      autoComplete="new-password"
                      value={req.password}
                      onChange={(e) => setReq({ ...req, password: e.target.value })}
                      required
                    />
                    <button
                      type="button"
                      className={styles.eyeBtn}
                      onClick={() => setShowReqPw((v) => !v)}
                      aria-label="비밀번호 표시"
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                        <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6z" />
                        <circle cx="12" cy="12" r="2.6" />
                      </svg>
                    </button>
                  </div>

                  <label className={styles.mLabel}>계정 요청 사유</label>
                  <div className={styles.field}>
                    <textarea
                      placeholder="계정이 필요한 사유를 간단히 적어주세요"
                      value={req.reason}
                      onChange={(e) => setReq({ ...req, reason: e.target.value })}
                      required
                    />
                  </div>

                  <button className={styles.submitBtn} type="submit">
                    요청하기
                  </button>
                </form>
              </div>
            ) : (
              <div className={styles.modalSuccess}>
                <div className={styles.check}>
                  <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#4cc3ec" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 12.5l5 5L20 6.5" />
                  </svg>
                </div>
                <h3>계정 생성을 요청하였습니다.</h3>
                <p>관리자가 확인 후 회신 드릴 예정입니다.</p>
                <button className={styles.okBtn} onClick={() => setModalOpen(false)}>
                  확인
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
