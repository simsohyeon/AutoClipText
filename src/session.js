'use strict';

// 채팅별로 들어오는 사진/장소명을 잠깐 모아두는 버퍼.
// 사진이 여러 장(앨범)으로 나뉘어 도착하므로, 마지막 입력 후 debounce 시간만큼
// 더 기다렸다가 한 묶음으로 처리한다.
// 처리 후에는 lastJob 에 입력을 보관해 '다시 생성' 에 재사용한다.

class PendingStore {
  constructor() {
    this.map = new Map(); // chatId -> { photos, placeName, note, timer }
    this.lastJob = new Map(); // chatId -> { placeName, note, images }
  }

  get(chatId) {
    if (!this.map.has(chatId)) {
      this.map.set(chatId, { photos: [], placeName: null, note: null, timer: null });
    }
    return this.map.get(chatId);
  }

  addPhoto(chatId, photo) {
    this.get(chatId).photos.push(photo);
  }

  setPlace(chatId, placeName) {
    this.get(chatId).placeName = placeName;
  }

  setNote(chatId, note) {
    this.get(chatId).note = note;
  }

  clear(chatId) {
    const s = this.map.get(chatId);
    if (s && s.timer) clearTimeout(s.timer);
    this.map.delete(chatId);
  }

  saveLast(chatId, job) {
    this.lastJob.set(chatId, job);
  }

  getLast(chatId) {
    return this.lastJob.get(chatId);
  }

  // debounce: 지정 시간 동안 추가 입력이 없으면 fn 실행
  schedule(chatId, ms, fn) {
    const s = this.get(chatId);
    if (s.timer) clearTimeout(s.timer);
    s.timer = setTimeout(fn, ms);
  }
}

module.exports = new PendingStore();
