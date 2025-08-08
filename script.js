'use strict';
document.addEventListener('DOMContentLoaded', () => {
    const startInput = document.getElementById('start');
    const endInput = document.getElementById('end');
    const alldayCheckbox = document.getElementById('allday');
    const errorMessage = document.getElementById('errorMessage');
    const form = document.getElementById('eventForm');
    const downloadLink = document.getElementById('downloadLink');
    // 15分単位で現在時刻を丸めて返す
    function getRoundedLocalTime(minutes = 15) {
        const now = new Date();
        now.setSeconds(0);
        now.setMilliseconds(0);
        const remainder = minutes - (now.getMinutes() % minutes);
        // ちょうどのときは次の単位にしない
        now.setMinutes(now.getMinutes() + (remainder === minutes ? 0 : remainder));
        const yyyy = now.getFullYear();
        const mm = String(now.getMonth() + 1).padStart(2, '0');
        const dd = String(now.getDate()).padStart(2, '0');
        const hh = String(now.getHours()).padStart(2, '0');
        const min = String(now.getMinutes()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
    }
    startInput.value = getRoundedLocalTime();
    endInput.value = getRoundedLocalTime(30);
    // 終了日時がユーザーにより編集されたかどうかのフラグ
    let userEditedEnd = false;
    endInput.addEventListener('change', () => {
        userEditedEnd = true;
        if (new Date(endInput.value) <= new Date(startInput.value)) {
            endInput.setCustomValidity("終了日時は開始日時より後にしてください。");
            endInput.reportValidity();
        } else {
            endInput.setCustomValidity("");
        }
    });
    startInput.addEventListener('change', () => {
        const startDate = new Date(startInput.value);
        if (!userEditedEnd) {
            const endDate = new Date(startDate.getTime() + 15 * 60 * 1000);
            const yyyy = endDate.getFullYear();
            const mm = String(endDate.getMonth() + 1).padStart(2, '0');
            const dd = String(endDate.getDate()).padStart(2, '0');
            const hh = String(endDate.getHours()).padStart(2, '0');
            const min = String(endDate.getMinutes()).padStart(2, '0');
            endInput.value = `${yyyy}-${mm}-${dd}T${hh}:${min}`;
        }
        if (new Date(endInput.value) <= new Date(startInput.value)) {
            endInput.setCustomValidity("終了日時は開始日時より後にしてください。");
            endInput.reportValidity();
        } else {
            endInput.setCustomValidity("");
        }
    });
    // 終日チェック時の入力制御と視覚効果
    alldayCheckbox.addEventListener('change', () => {
        const isAllDay = alldayCheckbox.checked;
        startInput.readOnly = isAllDay;
        endInput.readOnly = isAllDay;
        startInput.classList.toggle('allday', isAllDay);
        endInput.classList.toggle('allday', isAllDay);
    });
    // 時刻が15分単位かどうかの判定
    function isValidStep(dateStr, stepMinutes = 15) {
        if (!dateStr) return false;
        const date = new Date(dateStr);
        return date.getMinutes() % stepMinutes === 0;
    }
    // ICS用テキストエスケープ
    function escapeICS(text) {
        return (text || '')
            .replace(/\\/g, '\\\\')
            .replace(/;/g, '\\;')
            .replace(/,/g, '\\,')
            .replace(/\r\n|\r|\n/g, '\\n');
    }
    // UID生成
    function generateUID() {
        const randomStr = Math.random().toString(36).substr(2, 9);
        return `${Date.now()}-${randomStr}@example.com`;
    }
    // 前回生成のBlob URL管理
    let prevUrl = null;
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        errorMessage.textContent = '';
        const titleInput = document.getElementById('title');
        const location = document.getElementById('location').value;
        const description = document.getElementById('description').value;
        const isAllDay = alldayCheckbox.checked;
        const startValue = startInput.value;
        const endValue = endInput.value;
        startInput.setCustomValidity("");
        endInput.setCustomValidity("");
        if (!titleInput.value.trim()) {
            titleInput.setCustomValidity("タイトルを入力してください。");
            titleInput.reportValidity();
            return;
        }
        if (!isAllDay && new Date(endValue) <= new Date(startValue)) {
            errorMessage.textContent = "⚠️ 終了日時が開始日時より前になっています。正しい日時を入力してください。";
            return;
        }
        if (!isAllDay && (!isValidStep(startValue) || !isValidStep(endValue))) {
            errorMessage.textContent = "⚠️ 時刻は15分単位で入力してください。";
            return;
        }
        let dtStart, dtEnd;
        if (isAllDay) {
            // 終日イベントは終了日の翌日をDTENDに指定
            const startDateStr = startValue.slice(0, 10);
            const endDateStr = endValue.slice(0, 10);
            const startDate = new Date(startDateStr);
            const endDate = new Date(endDateStr);
            endDate.setDate(endDate.getDate() + 1);
            const formatDate = (date) => {
                const yyyy = date.getFullYear();
                const mm = String(date.getMonth() + 1).padStart(2, '0');
                const dd = String(date.getDate()).padStart(2, '0');
                return `${yyyy}${mm}${dd}`;
            };
            dtStart = `DTSTART;VALUE=DATE:${formatDate(startDate)}`;
            dtEnd = `DTEND;VALUE=DATE:${formatDate(endDate)}`;
        } else {
            // タイムゾーンはUTC（Z）で出力
            const start = new Date(startValue).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
            const end = new Date(endValue).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
            dtStart = `DTSTART:${start}`;
            dtEnd = `DTEND:${end}`;
        }
        const uid = generateUID();
        const dtstamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
        const icsContent =
            `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:${uid}
DTSTAMP:${dtstamp}
SUMMARY:${escapeICS(titleInput.value)}
${dtStart}
${dtEnd}
LOCATION:${escapeICS(location)}
DESCRIPTION:${escapeICS(description)}
END:VEVENT
END:VCALENDAR`;
        // Blob生成とメモリ管理
        if (prevUrl) URL.revokeObjectURL(prevUrl);
        const blob = new Blob([icsContent], { type: 'text/calendar' });
        const url = URL.createObjectURL(blob);
        prevUrl = url;
        downloadLink.href = url;
        downloadLink.style.display = 'block';
        // フォーム送信後にユーザーが終了日時を編集したフラグをリセット
        userEditedEnd = false;
    });
});