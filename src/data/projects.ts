// 项目数据配置文件
// 用于管理项目展示页面的数据

export interface Project {
	id: string;
	title: string;
	description: string;
	image: string;
	category: 'web' | 'mobile' | 'desktop' | 'other';
	techStack: string[];
	status: 'completed' | 'in-progress' | 'planned';
	links?:{github?:string,demo?:string}
	sourceCode?: string;
	startDate: string;
	endDate?: string;
	featured?: boolean;
	tags?: string[];
	images?: string[];
}

export const projectsData: Project[] = [
	{
		id: 'my-blog',
		title: 'Mizuki Blog Theme',
		description: '基于Astro框架以及mizuki主题设计的个人用。',
		image: '',
		category: 'web',
		techStack: ['Astro', 'TypeScript', 'Tailwind CSS', 'Svelte'],
		status: 'completed',
		sourceCode: 'https://github.com/J0ze/Ochagama.github.io',
		startDate: '2025-09-08',
		endDate: '2025-09-09',
		featured: false,
		tags: ['Blog', 'Theme', 'Open Source']
	},
	{
		id: 'evadebug',
		title: 'Evadebug',
		description: '由校内六人团队开发的Unity引擎游戏',
		image: '',
		category: 'other',
		techStack: ['C#', 'Unity', 'Zenject', 'P-SCM'],
		status: 'completed',
		sourceCode: '',
		startDate: '2025-010-10',
		endDate: '2025-10-27',
		featured: true,
		tags: ['Unity', 'Csharp', 'DVC','Zenject']
	},
];

// 获取项目统计信息
export const getProjectStats = () => {
	const total = projectsData.length;
	const completed = projectsData.filter(p => p.status === 'completed').length;
	const inProgress = projectsData.filter(p => p.status === 'in-progress').length;
	const planned = projectsData.filter(p => p.status === 'planned').length;

	return {
		total,
		byStatus: {
			completed,
			inProgress,
			planned
		}
	};
};

// 按分类获取项目
export const getProjectsByCategory = (category?: string) => {
	if (!category || category === 'all') {
		return projectsData;
	}
	return projectsData.filter(p => p.category === category);
};

// 获取特色项目
export const getFeaturedProjects = () => {
	return projectsData.filter(p => p.featured);
};

// 获取所有技术栈
export const getAllTechStack = () => {
	const techSet = new Set<string>();
	projectsData.forEach(project => {
		project.techStack.forEach(tech => techSet.add(tech));
	});
	return Array.from(techSet).sort();
};