'use strict';

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('eventForm');
  const titleInput = document.getElementById('title');
  const startInput = document.getElementById('start');
  const endInput = document.getElementById('end');
  const alldayCheckbox = document.getElementById('allday');
  const locationInput = document.getElementById('location');
  const descriptionInput = document.getElementById('description');
  const downloadLink = document.getElementById('downloadLink');
  const errorMessage = document.getElementById('errorMessage');

  const DEFAULT_DURATION_MIN = 30; // 初期の所要時間（開始+30分）

  // 現在時刻を step 分単位に切り上げ（ちょうどのときはそのまま）
  function getRoundedLocalTime(minutes = 15) {
    const now = new Date();
    now.setSeconds(0);
    now.setMilliseconds(0);
    const mod = now.getMinutes() % minutes;
    if (mod !== 0) now.setMinutes(now.getMinutes() + (minutes - mod));
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const hh = String(now.getHours()).padStart(2, '0');
    const min = String(now.getMinutes()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
  }

  function toLocalDate(dateTimeLocalStr) {
    // input[type=datetime-local] の値をローカル時刻として解釈
    return new Date(dateTimeLocalStr);
  }
  function addMinutes(date, minutes) {
    return new Date(date.getTime() + minutes * 60 * 1000);
  }
  function fmtDateTimeUTC(date) {
    // ICS の UTC 形式: YYYYMMDDTHHMMSSZ（秒あり）
    const iso = date.toISOString(); // 例: 2025-08-08T01:30:00.000Z
    const base = iso.replace(/[-:]/g, '').split('.')[0]; // 20250808T013000
    return `${base}Z`;
  }
  function fmtDateValue(date) {
    // ICS VALUE=DATE: YYYYMMDD
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yyyy}${mm}${dd}`;
  }

  // ICS テキスト用エスケープ（RFC 5545）
  function escapeICS(text) {
    if (!text) return '';
    return String(text)
      .replace(/\\/g, '\\\\') // バックスラッシュ
      .replace(/;/g, '\\;')   // セミコロン
      .replace(/,/g, '\\,')   // カンマ
      .replace(/\r\n|\r|\n/g, '\\n'); // 改行
  }

  // 75オクテット折返し（ASCII 前提の簡易実装）
  function foldLine(line, limit = 75) {
    const out = [];
    let i = 0;
    while (i < line.length) {
      out.push(line.slice(i, i + limit));
      i += limit;
      if (i < line.length) out[out.length - 1] += '\r\n '; // 継続行は先頭にスペース
    }
    return out.join('');
  }

  function buildICS({
    title, startStr, endStr, allDay, location, description
  }) {
    const uid = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}@example.com`;
    const dtstamp = fmtDateTimeUTC(new Date());

    let dtStartLine, dtEndLine;
    if (allDay) {
      const startDate = new Date(startStr.slice(0, 10));
      const endDate = new Date(endStr.slice(0, 10));
      // DTEND は翌日
      const endNext = new Date(endDate.getTime());
      endNext.setDate(endNext.getDate() + 1);
      dtStartLine = `DTSTART;VALUE=DATE:${fmtDateValue(startDate)}`;
      dtEndLine = `DTEND;VALUE=DATE:${fmtDateValue(endNext)}`;
    } else {
      dtStartLine = `DTSTART:${fmtDateTimeUTC(toLocalDate(startStr))}`;
      dtEndLine   = `DTEND:${fmtDateTimeUTC(toLocalDate(endStr))}`;
    }

    const lines = [
      'BEGIN:VCALENDAR',
      'PRODID:-//ICS Generator//v1//JA',
      'VERSION:2.0',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTAMP:${dtstamp}`,
      `SUMMARY:${escapeICS(title)}`,
      dtStartLine,
      dtEndLine,
      `LOCATION:${escapeICS(location)}`,
      `DESCRIPTION:${escapeICS(description)}`,
      'END:VEVENT',
      'END:VCALENDAR'
    ].map(l => foldLine(l));

    // CRLF で結合（末尾にも CRLF）
    return lines.join('\r\n') + '\r\n';
  }

  // 初期値設定：開始＝現在を15分丸め、終了＝開始＋デフォルト所要
  startInput.value = getRoundedLocalTime(15);
  endInput.value = (() => {
    const end = addMinutes(toLocalDate(startInput.value), DEFAULT_DURATION_MIN);
    const yyyy = end.getFullYear();
    const mm = String(end.getMonth() + 1).padStart(2, '0');
    const dd = String(end.getDate()).padStart(2, '0');
    const hh = String(end.getHours()).padStart(2, '0');
    const min = String(end.getMinutes()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
  })();

  // ユーザーが終了を手で触ったか
  let userEditedEnd = false;

  function minutesStepOK(dateStr, step = 15) {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    return d.getMinutes() % step === 0 && d.getSeconds() === 0;
  }

  endInput.addEventListener('change', () => {
    userEditedEnd = true;
    if (!alldayCheckbox.checked && toLocalDate(endInput.value) <= toLocalDate(startInput.value)) {
      endInput.setCustomValidity("終了日時は開始日時より後にしてください。");
      endInput.reportValidity();
    } else {
      endInput.setCustomValidity("");
    }
  });

  startInput.addEventListener('change', () => {
    const startDate = toLocalDate(startInput.value);
    if (!userEditedEnd) {
      const endDate = addMinutes(startDate, DEFAULT_DURATION_MIN);
      const yyyy = endDate.getFullYear();
      const mm = String(endDate.getMonth() + 1).padStart(2, '0');
      const dd = String(endDate.getDate()).padStart(2, '0');
      const hh = String(endDate.getHours()).padStart(2, '0');
      const min = String(endDate.getMinutes()).padStart(2, '0');
      endInput.value = `${yyyy}-${mm}-${dd}T${hh}:${min}`;
    }
    if (!alldayCheckbox.checked && toLocalDate(endInput.value) <= startDate) {
      endInput.setCustomValidity("終了日時は開始日時より後にしてください。");
      endInput.reportValidity();
    } else {
      endInput.setCustomValidity("");
    }
  });

  // 終日 ON/OFF
  alldayCheckbox.addEventListener('change', () => {
    const isAllDay = alldayCheckbox.checked;
    startInput.readOnly = isAllDay;
    endInput.readOnly = isAllDay;
    startInput.classList.toggle('allday', isAllDay);
    endInput.classList.toggle('allday', isAllDay);
  });

  // 生成とダウンロード
  let prevUrl = null;

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    errorMessage.textContent = '';

    if (!titleInput.value.trim()) {
      titleInput.setCustomValidity("タイトルを入力してください。");
      titleInput.reportValidity();
      return;
    } else {
      titleInput.setCustomValidity("");
    }

    if (!alldayCheckbox.checked) {
      if (toLocalDate(endInput.value) <= toLocalDate(startInput.value)) {
        errorMessage.textContent = "⚠️ 終了日時が開始日時より前になっています。正しい日時を入力してください。";
        return;
      }
      if (!minutesStepOK(startInput.value) || !minutesStepOK(endInput.value)) {
        errorMessage.textContent = "⚠️ 時刻は15分単位で入力してください。";
        return;
      }
    } else {
      // 終日: 開始日 <= 終了日
      const sd = new Date(startInput.value.slice(0, 10));
      const ed = new Date(endInput.value.slice(0, 10));
      if (ed < sd) {
        errorMessage.textContent = "⚠️ 終日の場合、終了日は開始日以降にしてください。";
        return;
      }
    }

    const icsContent = buildICS({
      title: titleInput.value,
      startStr: startInput.value,
      endStr: endInput.value,
      allDay: alldayCheckbox.checked,
      location: locationInput.value,
      description: descriptionInput.value
    });

    // 以前の Blob URL を解放
    if (prevUrl) URL.revokeObjectURL(prevUrl);

    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    prevUrl = url;

    // ダウンロードファイル名
    const safeTitle = (titleInput.value.trim() || 'event')
      .replace(/[\\/:*?"<>|]/g, '_')
      .slice(0, 80);
    downloadLink.href = url;
    downloadLink.download = `${safeTitle}.ics`;
    downloadLink.style.display = 'block';
    downloadLink.textContent = 'ICS をダウンロード';

    // 終了を手で編集したフラグをリセット
    userEditedEnd = false;
  });

  // ページ離脱時に URL を開放
  window.addEventListener('beforeunload', () => {
    if (prevUrl) URL.revokeObjectURL(prevUrl);
  });
});
