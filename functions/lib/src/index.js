"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.onNotificationCreated = void 0;
const firestore_1 = require("firebase-functions/v2/firestore");
const v2_1 = require("firebase-functions/v2");
const admin = __importStar(require("firebase-admin"));
const node_fetch_1 = __importDefault(require("node-fetch"));
admin.initializeApp();
const db = admin.firestore();
(0, v2_1.setGlobalOptions)({ region: 'asia-northeast3' }); // 서울 리전
function buildBody(type, fromNickname) {
    switch (type) {
        case 'friendRequest': return `${fromNickname}님이 친구 요청을 보냈어요`;
        case 'friendAccepted': return `${fromNickname}님이 친구 요청을 수락했어요`;
        case 'comment': return `${fromNickname}님이 내 조각에 댓글을 달았어요`;
        case 'mention': return `${fromNickname}님이 댓글에서 나를 언급했어요`;
        case 'reaction': return `${fromNickname}님이 내 조각에 공감을 남겼어요`;
        default: return `${fromNickname}님으로부터 알림이 왔어요`;
    }
}
exports.onNotificationCreated = (0, firestore_1.onDocumentCreated)('notifications/{notifId}', async (event) => {
    var _a, _b, _c, _d, _e;
    const notif = (_a = event.data) === null || _a === void 0 ? void 0 : _a.data();
    if (!notif)
        return;
    const toUid = notif.toUid;
    const fromUid = notif.fromUid;
    const type = notif.type;
    const postId = notif.postId;
    // 자기 자신에게 보내는 알림은 skip
    if (toUid === fromUid)
        return;
    // 수신자 push token + 발신자 닉네임 조회
    const [toProfile, fromProfile] = await Promise.all([
        db.collection('profiles').doc(toUid).get(),
        db.collection('profiles').doc(fromUid).get(),
    ]);
    const token = (_b = toProfile.data()) === null || _b === void 0 ? void 0 : _b.expoPushToken;
    if (!token || !token.startsWith('ExponentPushToken'))
        return;
    const fromNickname = (_d = (_c = fromProfile.data()) === null || _c === void 0 ? void 0 : _c.nickname) !== null && _d !== void 0 ? _d : '알 수 없음';
    const body = buildBody(type, fromNickname);
    // Expo Push API 호출
    const response = await (0, node_fetch_1.default)('https://exp.host/--/api/v2/push/send', {
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
            data: { postId: postId !== null && postId !== void 0 ? postId : null, type },
            sound: 'default',
            badge: 1,
            channelId: 'default',
        }),
    });
    const result = await response.json();
    if (((_e = result.data) === null || _e === void 0 ? void 0 : _e.status) === 'error') {
        v2_1.logger.warn('Push send error', result.data.message);
    }
});
//# sourceMappingURL=index.js.map