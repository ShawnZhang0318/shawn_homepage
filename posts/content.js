export const posts = [{
  slug: 'how-i-built-my-3d-homepage',
  title: 'How I built my 3D homepage',
  description: '这间书房怎么搭起来，交互怎么接上，还有那些改了好几次的小东西。',
  date: '2026-11-24',
  dateLabel: '24 November 2026',
  topic: 'Design & development',
  status: '草稿',
  intro: '这篇先记一下这个主页是怎么做的。现在还没做完，很多地方还会接着改。',
  sections: [
    {
      id: 'a-room',
      title: '先做一间我愿意待着的房间',
      paragraphs: [
        '一开始，我只是想找个地方放自己的介绍、做过的东西，还有以后可能会写的文章。我想把这些东西放进一个能四处看看的空间。',
        '看了 Felix Rieseberg 的主页后，我很喜欢那种感觉。你可以在房间里看看，点一下桌上的东西，再慢慢了解这个人。我也想做一个这样的空间。',
        '所以我选了书房。窗外是上海的夜景，桌上有电脑、咖啡、笔记本，旁边放着机械臂和一些工具。机器人和 AI 都是我平时会接触的东西，把它们摆在这里挺合适。',
      ],
    },
    {
      id: 'models',
      title: '大部分时间都花在小东西上',
      paragraphs: [
        '模型主要用 Blender 做，网页里的场景和交互用 Three.js 接起来。做的时候经常卡在一些小地方。',
        '比如椅子。正面看还行，转到侧面，坐垫薄得像一张板。还有机械臂，远看没什么问题，靠近才发现夹爪和手腕之间像是断开的。笔记本也改了好几轮，纸页的厚度和中间的弯折一直看着不对。',
        '灯光更容易让人误判。金属太亮会像塑料，灯下的一块桌面过曝了，整个房间也会显得假。最后还是得放回实际网页里，走近一点，从旁边再看一眼。',
      ],
    },
    {
      id: 'interactions',
      title: '让桌上的东西真的有点用',
      paragraphs: [
        '房间搭出来后，我开始想，介绍和文章应该放在哪儿。',
        'About 放在桌上的笔记本里。点一下，先走近桌面，再把本子翻开。Work 是压在本子上的那张纸，拿起来以后可以看上面的经历。Posts 则放进台式显示器，像坐下来打开自己的博客。',
        '这些动作也需要反复调。之前点 Work，纸会直接从几米外飞到眼前。能用，但怎么看都别扭。后来加了先走到桌边的过程，才像是自己过去拿起来。',
      ],
    },
    {
      id: 'working-with-ai',
      title: '和 AI 一起做，还是得自己看',
      paragraphs: [
        '这个主页的制作过程中，我用了很多 AI 帮忙写代码、改模型和排查问题。它确实省了不少时间，也让我能继续尝试一些原本可能懒得做的细节。',
        '不过，“代码跑通了”和“看起来对了”经常是两回事。有时候它会很认真地告诉我已经修好了，我打开网页，还是能一眼看到穿模。也有时候只是我没把要求说清楚，比如我拿一张图当材质参考，最后连图里的内袋也被做到了笔记本上。',
        '所以现在我的习惯很简单：先做一版，放进房间，看实际效果。觉得不对就指出具体哪里不对，再改。',
      ],
    },
    {
      id: 'next',
      title: '先做到这里',
      paragraphs: [
        '现在这个主页还在慢慢做。房间里的大部分东西已经有了，导航和内容也开始接进来。这篇文章就是用来试一下博客阅读页的第一份草稿。',
        '之后我会继续补一些做过的项目，也写写机器人、AI 工具，或者别的最近在折腾的东西。至于这间书房，估计还会改很多次。',
      ],
    },
  ],
}];

// Temporary entries for reviewing the five-row monitor layout.
for (const [slug, title, topic] of [
  ['notes-from-robomaster', 'Notes from RoboMaster', 'Robotics'],
  ['when-the-robot-stops', 'Why the robot stopped moving', 'Robotics'],
  ['small-ai-tools', 'Small AI tools I keep using', 'AI tools'],
  ['a-quieter-workspace', 'A quieter place to work', 'Design'],
]) {
  posts.push({
    slug, title, topic,
    description: '占位稿，正文之后补充。',
    date: '2026-11-24',
    dateLabel: 'Placeholder draft',
    status: '占位稿',
    intro: '这篇先占一个位置，正文之后再补。',
    sections: [{
      id: 'draft',
      title: '待补充',
      paragraphs: ['目前先用来看看文章列表和阅读页的排版。等整理好内容，再把这段换掉。'],
    }],
  });
}

export function readingMinutes(post) {
  const text = [post.intro, ...post.sections.flatMap(section => section.paragraphs)].join('');
  return Math.max(1, Math.ceil(text.length / 450));
}
