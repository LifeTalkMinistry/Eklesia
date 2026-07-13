export const mockEcosystems = [
  {
    id: 'lifetalk-yp',
    name: 'LifeTalk Young Professionals',
    code: 'LIFETALK30',
    ownerName: 'Max Emorej',
    planName: 'Circle',
    memberLimit: 30,
    memberCount: 24,
    description:
      'A devotional accountability circle for the LifeTalk Young Professionals ministry.',
    members: [
      {
        id: 'member-max',
        name: 'Max',
        status: 'Completed today',
        growthSignal: 'Steady rhythm',
        lastActiveLabel: 'Today',
        canEncourage: false,
      },
      {
        id: 'member-maria',
        name: 'Maria',
        status: 'Active recently',
        growthSignal: 'Growing consistently',
        lastActiveLabel: 'Yesterday',
        canEncourage: true,
      },
      {
        id: 'member-john',
        name: 'John',
        status: 'Recently quiet',
        growthSignal: 'May appreciate encouragement',
        lastActiveLabel: '4 days ago',
        canEncourage: true,
      },
    ],
  },
];
