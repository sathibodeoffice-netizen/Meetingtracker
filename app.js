/**
 * মিটিং ট্র্যাকার — Shared App Logic
 * Handles: auth, state, API calls, utilities
 */

'use strict';

// ── Auth guard ────────────────────────────────────────────────
if (!localStorage.getItem('mt_token')) {
  window.location.replace('/');
}

// ── Utilities ────────────────────────────────────────────────
const generateId = () => '_' + Math.random().toString(36).slice(2, 11);

function escapeHTML(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function showToast(msg, type = 'success') {
  let el = document.getElementById('app-toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'app-toast';
    el.className = 'toast';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.style.background = type === 'error'
    ? 'rgba(239,68,68,0.15)'
    : 'rgba(16,185,129,0.15)';
  el.style.borderColor = type === 'error'
    ? 'rgba(239,68,68,0.3)'
    : 'rgba(16,185,129,0.3)';
  el.style.color = type === 'error' ? '#f87171' : '#34d399';
  el.classList.add('show');
  clearTimeout(el._timer);
  el._timer = setTimeout(() => el.classList.remove('show'), 3000);
}

// ── Department Config ─────────────────────────────────────────
const DEPARTMENTS = [
  { key: 'calling',       label: 'কলিং বিভাগ',          icon: '📞' },
  { key: 'review',        label: 'রিভিউ বিভাগ',           icon: '🔍' },
  { key: 'report',        label: 'রিপোর্ট বিভাগ',          icon: '📊' },
  { key: 'quality',       label: 'কোয়ালিটি চেক',         icon: '✅' },
  { key: 'marketing',     label: 'মার্কেটিং বিভাগ',       icon: '📈' },
  { key: 'technical',     label: 'টেকনিক্যাল বিভাগ',      icon: '💻' },
  { key: 'rd',            label: 'গবেষণা বিভাগ (R&D)',    icon: '🔬' },
  { key: 'hr',            label: 'এইচআর বিভাগ',            icon: '👥' },
  { key: 'halal_bondhon', label: 'হালাল বন্ধন',            icon: '💍' },
  { key: 'general',       label: 'সাধারণ বিভাগ',           icon: '📌' },
];

const DEPT_MAP = Object.fromEntries(DEPARTMENTS.map(d => [d.key, d]));

function getDept(key) {
  return DEPT_MAP[key] || { key, label: key, icon: '📌' };
}

const PRIORITY_LABELS = { high: 'অধিক জরুরি', medium: 'মাঝারি', low: 'কম জরুরি' };
const PRIORITY_BADGE  = { high: 'badge-high',  medium: 'badge-medium', low: 'badge-low' };

const MONTH_NAMES = [
  'জানুয়ারি','ফেব্রুয়ারি','মার্চ','এপ্রিল','মে','জুন',
  'জুলাই','আগস্ট','সেপ্টেম্বর','অক্টোবর','নভেম্বর','ডিসেম্বর'
];
const MONTH_SHORT = ['জান','ফেব','মার','এপ্র','মে','জুন','জুল','আগ','সেপ','অক্ট','নভ','ডিস'];

// ── App State ─────────────────────────────────────────────────
const APP = {
  meetings: [],
  activeYear: new Date().getFullYear(),
  activeMonth: 'all',
  theme: localStorage.getItem('mt_theme') || 'dark',

  get filteredMeetings() {
    return this.meetings.filter(m => {
      const d = new Date(m.date);
      const yearOk = d.getFullYear() === this.activeYear;
      const monthOk = this.activeMonth === 'all' || d.getMonth() === Number(this.activeMonth);
      return yearOk && monthOk;
    });
  },

  // Stats helpers
  taskStats(meetingList) {
    let total = 0, done = 0, incomplete = 0;
    meetingList.forEach(m => {
      (m.tasks || []).forEach(t => {
        total++;
        const s = t.status || (t.completed ? 'done' : 'open');
        if (s === 'done') done++;
        else if (s === 'incomplete') incomplete++;
      });
    });
    return { total, done, incomplete, pending: total - done - incomplete, rate: total > 0 ? Math.round((done / total) * 100) : 0 };
  },

  async load() {
    try {
      const res = await fetch('/api/meetings');
      if (!res.ok) throw new Error('API error');
      const data = await res.json();
      this.meetings = Array.isArray(data) ? data : [];
    } catch (e) {
      console.warn('Could not load from DB:', e);
      this.meetings = [];
    }
  },

  async save() {
    try {
      await fetch('/api/meetings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(this.meetings)
      });
    } catch (e) {
      console.warn('Could not save to DB:', e);
    }
  }
};

// ── Theme ─────────────────────────────────────────────────────
function applyTheme(t) {
  document.body.classList.toggle('light', t === 'light');
}
applyTheme(APP.theme);

function toggleTheme() {
  APP.theme = APP.theme === 'dark' ? 'light' : 'dark';
  localStorage.setItem('mt_theme', APP.theme);
  applyTheme(APP.theme);
}

// ── Global UI wiring (called on each page after DOMContentLoaded) ──
function wireGlobal(onYearChange) {
  // Theme toggle
  const btnTheme = document.getElementById('btn-theme');
  if (btnTheme) btnTheme.addEventListener('click', () => {
    toggleTheme();
    if (typeof onYearChange === 'function') onYearChange();
  });

  // Year nav
  const yearDisplay = document.getElementById('year-display');
  const btnPrevYear = document.getElementById('btn-prev-year');
  const btnNextYear = document.getElementById('btn-next-year');

  function updateYearDisplay() {
    if (yearDisplay) yearDisplay.textContent = APP.activeYear;
  }
  updateYearDisplay();

  if (btnPrevYear) btnPrevYear.addEventListener('click', () => {
    APP.activeYear--;
    updateYearDisplay();
    if (typeof onYearChange === 'function') onYearChange();
  });
  if (btnNextYear) btnNextYear.addEventListener('click', () => {
    APP.activeYear++;
    updateYearDisplay();
    if (typeof onYearChange === 'function') onYearChange();
  });
}

// ── Shared Meeting Modal ──────────────────────────────────────
// Returns a function to open the modal; calls onSave(meeting) when saved
function createMeetingModal(onSave, onDelete) {
  const backdrop = document.getElementById('meeting-modal');
  if (!backdrop) return () => {};

  const form        = backdrop.querySelector('#meeting-form');
  const inputId     = backdrop.querySelector('#m-id');
  const inputTitle  = backdrop.querySelector('#m-title');
  const inputDate   = backdrop.querySelector('#m-date');
  const inputTime   = backdrop.querySelector('#m-time');
  const inputDesc   = backdrop.querySelector('#m-desc');
  const btnClose    = backdrop.querySelector('#m-close');
  const btnCancel   = backdrop.querySelector('#m-cancel');
  const btnDel      = backdrop.querySelector('#m-delete');
  const modalTitle  = backdrop.querySelector('#modal-heading');

  function close() { backdrop.classList.remove('open'); }

  btnClose?.addEventListener('click', close);
  btnCancel?.addEventListener('click', close);
  backdrop.addEventListener('click', e => { if (e.target === backdrop) close(); });

  if (btnDel) {
    btnDel.addEventListener('click', () => {
      const id = inputId.value;
      if (!id) return;
      if (!confirm('এই মিটিং এবং এর সমস্ত টাস্ক মুছে ফেলবেন?')) return;
      close();
      if (typeof onDelete === 'function') onDelete(id);
    });
  }

  form?.addEventListener('submit', e => {
    e.preventDefault();
    const id    = inputId.value;
    const title = inputTitle.value.trim();
    const date  = inputDate.value;
    const time  = inputTime.value;
    const desc  = inputDesc.value.trim();
    if (!title || !date || !time) return;

    let meeting;
    if (id) {
      // Edit
      meeting = APP.meetings.find(m => m.id === id);
      if (!meeting) return;
      meeting.title = title;
      meeting.date = date;
      meeting.time = time;
      meeting.description = desc;
    } else {
      // New
      meeting = { id: generateId(), title, date, time, description: desc, tasks: [], createdAt: new Date().toISOString() };
      APP.meetings.push(meeting);
    }
    APP.save();
    close();
    showToast(id ? 'মিটিং আপডেট হয়েছে' : 'মিটিং তৈরি হয়েছে');
    if (typeof onSave === 'function') onSave(meeting);
  });

  // Return open function
  return function openMeetingModal(meeting) {
    if (modalTitle) modalTitle.textContent = meeting ? 'মিটিং সম্পাদনা' : 'নতুন মিটিং';
    inputId.value    = meeting?.id || '';
    inputTitle.value = meeting?.title || '';
    inputDate.value  = meeting?.date || new Date().toISOString().split('T')[0];
    inputTime.value  = meeting?.time || '';
    inputDesc.value  = meeting?.description || '';
    if (btnDel) btnDel.style.display = meeting ? 'inline-flex' : 'none';
    backdrop.classList.add('open');
    setTimeout(() => inputTitle.focus(), 100);
  };
}

// ── Task Modal ────────────────────────────────────────────────
function createTaskModal(onSave) {
  const backdrop  = document.getElementById('task-modal');
  if (!backdrop) return () => {};

  const form      = backdrop.querySelector('#task-form');
  const inputId   = backdrop.querySelector('#t-id');
  const inputMid  = backdrop.querySelector('#t-meeting-id');
  const inputTitle= backdrop.querySelector('#t-title');
  const inputDesc = backdrop.querySelector('#t-desc');
  const selDept   = backdrop.querySelector('#t-dept');
  const selPri    = backdrop.querySelector('#t-priority');
  const inputAssn = backdrop.querySelector('#t-assignee');
  const btnClose  = backdrop.querySelector('#t-close');
  const btnCancel = backdrop.querySelector('#t-cancel');
  const heading   = backdrop.querySelector('#task-modal-heading');

  function close() { backdrop.classList.remove('open'); }
  btnClose?.addEventListener('click', close);
  btnCancel?.addEventListener('click', close);
  backdrop.addEventListener('click', e => { if (e.target === backdrop) close(); });

  form?.addEventListener('submit', e => {
    e.preventDefault();
    const mid = inputMid.value;
    const meeting = APP.meetings.find(m => m.id === mid);
    if (!meeting) return;

    const tid   = inputId.value;
    const title = inputTitle.value.trim();
    const desc  = inputDesc.value.trim();
    const dept  = selDept.value;
    const pri   = selPri.value;
    const assn  = inputAssn.value.trim();
    if (!title) return;

    if (tid) {
      // Edit existing
      const task = (meeting.tasks || []).find(t => t.id === tid);
      if (task) {
        task.title = title;
        task.description = desc;
        task.department = dept;
        task.priority = pri;
        task.assignee = assn;
      }
    } else {
      // New task
      if (!meeting.tasks) meeting.tasks = [];
      meeting.tasks.push({
        id: generateId(),
        title, description: desc,
        department: dept, priority: pri,
        assignee: assn,
        status: 'open',
        completed: false,
        remarks: '',
        createdAt: new Date().toISOString()
      });
    }
    APP.save();
    close();
    showToast(tid ? 'টাস্ক আপডেট হয়েছে' : 'টাস্ক যোগ করা হয়েছে');
    if (typeof onSave === 'function') onSave(meeting);
  });

  return function openTaskModal(meetingId, existingTask) {
    if (heading) heading.textContent = existingTask ? 'টাস্ক সম্পাদনা' : 'নতুন টাস্ক যোগ করুন';
    inputMid.value   = meetingId;
    inputId.value    = existingTask?.id || '';
    inputTitle.value = existingTask?.title || '';
    inputDesc.value  = existingTask?.description || '';
    selDept.value    = existingTask?.department || 'general';
    selPri.value     = existingTask?.priority || 'medium';
    inputAssn.value  = existingTask?.assignee || '';
    backdrop.classList.add('open');
    setTimeout(() => inputTitle.focus(), 100);
  };
}
