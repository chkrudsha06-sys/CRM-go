"use client";

import { useState } from "react";

export default function CiderPayTestPage() {
  const [result, setResult] = useState("");

  const sendTest = async () => {
    const payload = {
      transactionId: `TEST-CIDERPAY-${Date.now()}`,
      memberName: "홍길동",
      memberPhone: "01012345678",
      amount: 55000,
      paidAt: "2026-06-09",
      status: "PAID",
      productName: "분양회 월회비",
      paymentMethod: "신용카드",
    };

    const res = await fetch("/api/payment-imports/ciderpay", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-ciderpay-secret": "ciderpay-bunyanghoe-2026-secret",
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    setResult(JSON.stringify(data, null, 2));
  };

  return (
    <main className="min-h-screen bg-slate-950 p-10 text-white">
      <div className="mx-auto max-w-2xl rounded-2xl bg-slate-900 p-8 shadow-xl">
        <h1 className="mb-4 text-2xl font-bold">사이다페이 결제 테스트</h1>

        <p className="mb-6 text-slate-300">
          버튼을 누르면 테스트 결제 데이터가 CRM 매출방으로 전송됩니다.
        </p>

        <button
          onClick={sendTest}
          className="rounded-xl bg-blue-600 px-6 py-3 font-semibold hover:bg-blue-500"
        >
          테스트 결제 전송
        </button>

        {result && (
          <pre className="mt-6 overflow-auto rounded-xl bg-black p-4 text-sm text-green-300">
            {result}
          </pre>
        )}
      </div>
    </main>
  );
}
