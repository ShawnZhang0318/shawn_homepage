import { posts, readingMinutes } from './content.js';
const params = new URLSearchParams(location.search);
const post = posts.find(item => item.slug === params.get('post')) || (!params.has('post') ? posts[0] : null);
const room = new URL('../window-study/', import.meta.url);
const brand = params.get('brand');
if (brand) room.searchParams.set('brand', brand);
document.getElementById('home-view').href = room.href;
for (const anchor of document.querySelectorAll('[data-room-section]')) {
  const target = new URL(room);
  target.searchParams.set('section', anchor.dataset.roomSection);
  anchor.href = target.href;
}
room.searchParams.set('section', 'posts');
for (const id of ['back-to-room', 'footer-back']) document.getElementById(id).href = room.href;

if (!post) {
  document.title = 'Article not found · Yitong Zhang';
  document.getElementById('post-title').textContent = 'Article not found';
  document.querySelector('.article-meta').hidden = true;
  document.querySelector('.desktop-toc').hidden = true;
  document.querySelector('.mobile-toc').hidden = true;
  document.getElementById('post-intro').textContent = '这篇文章暂时还没有内容。可以回到书房看看其他文章。';
} else {
  document.title = post.title + ' · Yitong Zhang';
  document.getElementById('post-title').textContent = post.title;
  document.getElementById('post-date').textContent = post.dateLabel;
  document.getElementById('post-time').textContent = readingMinutes(post) + ' min';
  document.getElementById('post-topic').textContent = post.topic;
  document.getElementById('draft-label').textContent = post.status + ' / DRAFT';
  document.getElementById('post-intro').textContent = post.intro;
  const body = document.getElementById('post-body');
  for (const section of post.sections) {
    const part = document.createElement('section');
    part.id = section.id;
    const heading = document.createElement('h2');
    heading.textContent = section.title;
    part.append(heading);
    for (const text of section.paragraphs) {
      const paragraph = document.createElement('p');
      paragraph.textContent = text;
      part.append(paragraph);
    }
    body.append(part);
    for (const id of ['contents', 'mobile-contents']) {
      const link = document.createElement('a');
      link.href = '#' + section.id;
      link.textContent = section.title;
      document.getElementById(id).append(link);
    }
  }
  const toc = [...document.querySelectorAll('#contents a')];
  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      for (const link of toc) {
        if (link.hash === '#' + entry.target.id) link.setAttribute('aria-current', 'location');
        else link.removeAttribute('aria-current');
      }
    }
  }, { rootMargin: '-8% 0px -65% 0px', threshold: 0 });
  body.querySelectorAll('section').forEach(section => observer.observe(section));
}
