import { onDocumentCreated } from 'firebase-functions/v2/firestore'
import { setGlobalOptions, logger } from 'firebase-functions/v2'
import * as admin from 'firebase-admin'
import fetch from 'node-fetch'

admin.initializeApp()
const db = admin.firestore()

setGlobalOptions({ region: 'asia-northeast3' })  // 서울 리전

type NotifType = 'friendRequest' | 'friendAccepted' | 'comment' | 'reaction' | 'mention'

function buildBody(type: NotifType, fromNickname: string): string {
  switch (type) {
    case 'friendRequest':  return `${fromNickname}님이 친구 요청을 보냈어요`
    case 'friendAccepted': return `${fromNickname}님이 친구 요청을 수락했어요`
    case 'comment':        return `${fromNickname}님이 내 조각에 댓글을 달았어요`
    case 'mention':        return `${fromNickname}님이 댓글에서 나를 언급했어요`
    case 'reaction':       return `${fromNickname}님이 내 조각에 공감을 남겼어요`
    default:               return `${fromNickname}님으로부터 알림이 왔어요`
  }
}

export const onNotificationCreated = onDocumentCreated(
  'notifications/{notifId}',
  async (event) => {
    const notif = event.data?.data()
    if (!notif) return

    const toUid: string = notif.toUid
    const fromUid: string = notif.fromUid
    const type: NotifType = notif.type
    const postId: string | undefined = notif.postId

    // 자기 자신에게 보내는 알림은 skip
    if (toUid === fromUid) return

    // 수신자 push token + 발신자 닉네임 조회
    const [toProfile, fromProfile] = await Promise.all([
      db.collection('users').doc(toUid).get(),
      db.collection('users').doc(fromUid).get(),
    ])

    const token: string | undefined = toProfile.data()?.expoPushToken
    if (!token || !token.startsWith('ExponentPushToken')) return

    // 수신자 알림 설정 필터 (필드 없으면 기본값 true로 처리)
    const ns = toProfile.data()?.notifSettings
    if (ns?.all === false) return
    if ((type === 'friendRequest' || type === 'friendAccepted') && ns?.friendRequest === false) return
    if ((type === 'comment' || type === 'reaction') && ns?.commentReaction === false) return
    if (type === 'mention' && ns?.mention === false) return

    const fromNickname: string = fromProfile.data()?.nickname ?? '알 수 없음'
    const body = buildBody(type, fromNickname)

    // Expo Push API 호출
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: token,
        title: '하루조각',
        body,
        data: { postId: postId ?? null, type, notifId: event.params.notifId },
        sound: 'default',
        badge: 1,
        channelId: 'default',
      }),
    })

    const result = await response.json() as { data?: { status: string; message?: string } }
    if (result.data?.status === 'error') {
      logger.warn('Push send error', result.data.message)
    }
  }
)
