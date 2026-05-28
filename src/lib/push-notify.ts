// CRM 이벤트 발생 시 고객에게 푸시 알림 발송하는 헬퍼
export async function sendPushNotification({
  contactId,
  contactName,
  title,
  body,
  url,
  tag,
}: {
  contactId?: number;
  contactName?: string;
  title: string;
  body: string;
  url?: string;
  tag?: string;
}) {
  try {
    await fetch("/api/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contactId, contactName, title, body, url, tag }),
    });
  } catch {
    // 푸시 실패해도 CRM 동작에 영향 없음
  }
}

// 미리 정의된 알림 템플릿
export const PUSH_TEMPLATES = {
  mileageEarned: (name: string, amount: number) => ({
    title: "마일리지 적립",
    body: `${name}님, 하이타겟 마일리지 ${amount.toLocaleString()}P가 적립되었습니다.`,
    tag: "mileage-earn",
  }),
  rewardEarned: (name: string, amount: number, channel: string) => ({
    title: "리워드 적립",
    body: `${name}님, ${channel} 리워드 ${amount.toLocaleString()}원이 적립되었습니다.`,
    tag: "reward-earn",
  }),
  mileageUsed: (name: string, amount: number) => ({
    title: "마일리지 사용",
    body: `${name}님, 마일리지 ${amount.toLocaleString()}P가 사용되었습니다.`,
    tag: "mileage-use",
  }),
  rewardPaid: (name: string, amount: number, quarter: string) => ({
    title: "리워드 지급 완료",
    body: `${name}님, ${quarter} 리워드 ${amount.toLocaleString()}원이 지급 처리되었습니다.`,
    tag: "reward-paid",
  }),
  incentivePaid: (name: string, amount: number) => ({
    title: "🎉 인센티브 구간 달성!",
    body: `${name}님, 축하합니다! 누적리워드 인센티브 ${amount.toLocaleString()}원 구간에 달성하셨습니다.`,
    tag: "incentive-tier",
  }),
};
