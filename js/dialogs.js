import { buildFeedbackBody, feedbackStarLabel } from './feedback.js?v=bbf59962683f';
import { parseNoticeMarkup } from './notice-markup.js?v=bbf59962683f';
import { starLabel } from './rating.js?v=bbf59962683f';

const element = (tag, className, textContent = '') =>
  Object.assign(document.createElement(tag), { className, textContent });
const button = (text, className = '') => Object.assign(element('button', className, text), { type: 'button' });

export function createStarControl(label, choice, onChange, labelFor = starLabel) {
  const control = element('div', 'rating-control');
  const options = element('div', 'rating-options');
  options.setAttribute('role', 'group');
  options.setAttribute('aria-label', label);
  const status = element('div', 'rating-star-label');
  status.setAttribute('aria-live', 'polite');
  const stars = Array.from({ length: 5 }, (_, index) => {
    const star = button('☆', 'rating-star');
    star.replaceChildren(element('span', 'rating-star-glyph', '☆'));
    star.setAttribute('aria-label', `별 ${index + 1}개`);
    star.setAttribute('aria-pressed', 'false');
    star.addEventListener('click', () => {
      choice.stars = choice.stars === index + 1 ? null : index + 1;
      stars.forEach((item, position) => {
        item.classList.remove('star-pop');
        item.classList.toggle('filled', position < choice.stars);
        item.firstElementChild.textContent = position < choice.stars ? '★' : '☆';
        item.setAttribute('aria-pressed', String(choice.stars === position + 1));
      });
      status.textContent = labelFor(choice.stars);
      if (choice.stars !== null) {
        void options.offsetWidth; // 연속 클릭도 별 애니메이션을 처음부터 실행한다.
        stars.slice(0, choice.stars).forEach((item) => item.classList.add('star-pop'));
      }
      onChange();
    });
    return star;
  });
  options.append(...stars);
  control.append(options, status);
  return { control, stars };
}

function closeButton(dialog) {
  const close = button('✕', 'rating-close');
  close.setAttribute('aria-label', '닫기');
  close.addEventListener('click', () => dialog.close());
  return close;
}

function appendNoticeInline(parent, nodes) {
  for (const node of nodes) {
    if (node.type === 'text') {
      parent.append(node.value);
    } else if (node.type === 'link') {
      parent.append(Object.assign(element('a', 'notice-inline-link', node.text), {
        href: node.href, target: '_blank', rel: 'noopener',
      }));
    } else {
      const styled = element(node.tag, node.className);
      appendNoticeInline(styled, node.children);
      parent.append(styled);
    }
  }
}

function renderNoticeContent(text, title) {
  const content = element('div', 'notice-content');
  for (const block of parseNoticeMarkup(text, title)) {
    if (block.type === 'image') {
      const image = Object.assign(element('img', 'notice-image'), {
        alt: block.alt, referrerPolicy: 'no-referrer',
      });
      if (block.width < 100) {
        image.style.width = `${block.width}%`;
        image.classList.add('notice-image-centered');
      }
      image.addEventListener('error', () => image.remove(), { once: true });
      image.src = block.src;
      content.append(image);
    } else if (block.type === 'list') {
      const list = document.createElement('ul');
      for (const item of block.items) {
        const li = document.createElement('li');
        appendNoticeInline(li, item);
        list.append(li);
      }
      content.append(list);
    } else {
      const paragraph = document.createElement('p');
      block.lines.forEach((line, index) => {
        if (index) paragraph.append(document.createElement('br'));
        appendNoticeInline(paragraph, line);
      });
      content.append(paragraph);
    }
  }
  return content;
}

export function showNotice(dialog, notice, index, total, onHide) {
  const title = element('h2', 'notice-title', notice.title);
  title.id = 'notice-title';
  if (total > 1) title.append(' ', element('small', 'notice-count', `${index}/${total}`));
  const content = renderNoticeContent(notice.content, notice.title);
  const actions = element('div', 'rating-actions');
  const today = button('오늘 하루 안 보기');
  const forever = button('다시 띄우지 않기');
  for (const [action, kind] of [[today, 'today'], [forever, 'forever']]) {
    action.addEventListener('click', () => {
      onHide(notice.id, kind);
      dialog.close();
    });
  }
  actions.append(today, forever);
  let link;
  if (notice.link) {
    link = Object.assign(element('a', 'notice-link', notice.button), {
      href: notice.link, target: '_blank', rel: 'noopener',
    });
  }
  dialog.replaceChildren(closeButton(dialog), title, content, ...(link ? [link] : []), actions);
  dialog.showModal();
  (link ?? today).focus();
}

export function showFeedback(dialog, config, context) {
  const close = closeButton(dialog);
  const title = element('h2', '', '');
  title.id = 'feedback-title';
  title.append(element('span', '', '🤖 AI 추천 어땠어요?'),
    element('span', '', '베타 기능이라 의견이 큰 도움이 돼요'));
  const later = button('나중에', 'rating-later');
  later.addEventListener('click', () => dialog.close());
  const send = button('보내기', 'rating-send');
  const actions = element('div', 'rating-actions');
  actions.append(later, send);
  const status = element('p', 'rating-status');
  status.setAttribute('role', 'status');
  const questions = [
    ['feature', 'AI 추천 기능은 어떤가요?'],
    ['result', '추천 결과가 마음에 드나요?'],
  ];
  const choices = Object.fromEntries(questions.map(([key]) => [key, { stars: null }]));
  let sending = false;
  let timer;
  const syncSend = () => { send.disabled = sending || !choices.feature.stars || !choices.result.stars; };
  const stars = [];
  const rows = questions.map(([key, question]) => {
    const row = element('div', 'rating-row feedback-row');
    const { control, stars: options } = createStarControl(question, choices[key], syncSend, feedbackStarLabel);
    stars.push(...options);
    row.append(element('div', 'rating-name', question), control);
    return row;
  });
  const comment = Object.assign(element('textarea', 'feedback-comment'), { maxLength: 500, rows: 3 });
  const commentLabel = element('label', 'feedback-comment-label', '피드백이나 제안이 있으면 적어주세요 (선택)');
  commentLabel.append(comment);
  dialog.addEventListener('close', () => clearTimeout(timer), { once: true });
  send.addEventListener('click', async () => {
    if (send.disabled) return;
    sending = true;
    syncSend();
    for (const control of [...stars, comment]) control.disabled = true;
    status.textContent = '';
    try {
      const body = buildFeedbackBody(config.entries, {
        ...context, feature: choices.feature.stars, result: choices.result.stars, comment: comment.value,
      });
      await fetch(config.formUrl, { method: 'POST', mode: 'no-cors', body });
      if (!send.isConnected || !dialog.open) return;
      const done = button('닫기', 'rating-send rating-done');
      done.addEventListener('click', () => dialog.close());
      for (const field of [...rows, commentLabel, actions]) field.remove();
      dialog.append(done);
      done.focus();
      status.textContent = '고마워요! 의견 잘 받았어요';
      timer = setTimeout(() => dialog.close(), 3000);
    } catch {
      if (!send.isConnected || !dialog.open) return;
      for (const control of [...stars, comment]) control.disabled = false;
      sending = false;
      syncSend();
      send.focus();
      status.textContent = '보내지 못했어요. 잠시 뒤 다시 시도해 주세요';
    }
  });
  syncSend();
  dialog.replaceChildren(close, title, ...rows, commentLabel, actions, status);
  dialog.showModal();
  stars[0].focus();
}
