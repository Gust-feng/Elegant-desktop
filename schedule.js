// ==================== 全局数据存储 ====================
// 所有数据来源于动态加载的周次JSON文件
const ScheduleData = {
	raw: null,              // 原始JSON数据
	courses: [],            // 课程列表
	nodesLst: [],           // 节次列表
	date: [],               // 日期信息（包含星期名称）
	week: 0,                // 当前周次
	weekday: '',            // 当前星期
	topInfo: null,          // 顶部信息
	weekDays: []            // 星期名称数组（从 date 构建）
};

// ==================== 周次管理 ====================
const WeekManager = {
	currentWeek: null,           // 当前加载的周次
	lastCheckTime: null,         // 上次检查时间
	autoUpdateTimer: null,       // 自动更新定时器
	checkIntervalMinutes: 30,    // 检查间隔（分钟）
	currentDataHash: null,       // 当前课表数据的哈希值
	
	// 从 localStorage 获取缓存的周次
	getCachedWeek() {
		const cached = localStorage.getItem('schedule_current_week');
		return cached ? parseInt(cached) : null;
	},
	
	// 缓存当前周次到 localStorage
	setCachedWeek(week) {
		localStorage.setItem('schedule_current_week', week.toString());
		this.currentWeek = week;
	},
	
	// 获取上次成功加载的时间
	getLastLoadTime() {
		const cached = localStorage.getItem('schedule_last_load_time');
		return cached ? new Date(cached) : null;
	},
	
	// 记录成功加载的时间
	setLastLoadTime() {
		localStorage.setItem('schedule_last_load_time', new Date().toISOString());
		this.lastCheckTime = new Date();
	},
	
	// 获取缓存的数据哈希
	getCachedHash() {
		return localStorage.getItem('schedule_data_hash');
	},
	
	// 缓存数据哈希
	setCachedHash(hash) {
		localStorage.setItem('schedule_data_hash', hash);
		this.currentDataHash = hash;
	},
	
	// 计算课表数据的轻量哈希（用于检测调课）
	calculateHash(scheduleData) {
		// 只对关键字段进行哈希：课程列表的课程名、时间、地点
		const keyData = (scheduleData.courses || []).map(course => 
			`${course.courseName}|${course.weekDay}|${course.startTime}|${course.endTIme}|${course.location}`
		).join('||');
		
		// 简单的字符串哈希函数
		let hash = 0;
		for (let i = 0; i < keyData.length; i++) {
			const char = keyData.charCodeAt(i);
			hash = ((hash << 5) - hash) + char;
			hash = hash & hash; // 转换为32位整数
		}
		return hash.toString(36); // 转换为36进制字符串
	},
	
	// 检查是否应该尝试加载下周数据（周末晚上8点后）
	shouldCheckNextWeek() {
		const now = new Date();
		const day = now.getDay(); // 0=周日, 6=周六
		
		// 周末（周六或周日）全天都应该显示下周课表
		const isWeekend = (day === 0 || day === 6);
		
		if (!isWeekend) {
			return false;
		}
		
		// 周末模式：始终返回 true，让系统尝试加载最新的课表
		// 不再检查"今天是否已加载"，因为可能有新的课表文件生成
		return true;
	},
	
	// 检查是否应该检查调课（周一到周五的中午12点和晚上8点）
	shouldCheckCourseChange() {
		const now = new Date();
		const day = now.getDay(); // 0=周日, 1-5=周一到周五, 6=周六
		const hour = now.getHours();
		const minute = now.getMinutes();
		
		// 不是工作日（周一到周五）
		if (day === 0 || day === 6) {
			return false;
		}
		
		// 检查是否在目标时间点附近（±5分钟窗口）
		const isNoon = hour === 12 && minute <= 5; // 12:00-12:05
		const isEvening = hour === 20 && minute <= 5; // 20:00-20:05
		
		if (!isNoon && !isEvening) {
			return false;
		}
		
		// 检查本时间段是否已经检查过（避免在5分钟窗口内重复检查）
		const lastCheck = this.getLastLoadTime();
		if (lastCheck) {
			const timeDiff = (now - lastCheck) / 1000 / 60; // 分钟差
			// 如果距离上次检查不到10分钟，跳过
			if (timeDiff < 10) {
				return false;
			}
		}
		
		return true;
	},
	
	// 清理定时器
	clearTimer() {
		if (this.autoUpdateTimer) {
			clearInterval(this.autoUpdateTimer);
			this.autoUpdateTimer = null;
		}
	}
};

// ==================== 工具函数 ====================

// 格式化教室名称为分行显示
function timeStringToMinutes(value) {
	if (!value || typeof value !== 'string') {
		return 0;
	}
	const [hourStr, minuteStr] = value.split(':');
	const hours = parseInt(hourStr, 10);
	const minutes = parseInt(minuteStr, 10);
	if (Number.isNaN(hours) || Number.isNaN(minutes)) {
		return 0;
	}
	return hours * 60 + minutes;
}

function formatLocation(location) {
	const buildParts = text => {
		if (!text) {
			return { main: '', detail: '' };
		}
		const parenIndex = text.indexOf('(');
		if (parenIndex === -1) {
			return { main: text, detail: '' };
		}
		return {
			main: text.substring(0, parenIndex),
			detail: text.substring(parenIndex)
		};
	};

	if (!location || (Array.isArray(location) && location.length === 0)) {
		return '<div class="schedule-location"></div>';
	}
	
	if (Array.isArray(location)) {
		const uniqueEntries = [];
		const seen = new Set();
		location.forEach(entry => {
			if (!entry) {
				return;
			}
			if (seen.has(entry)) {
				return;
			}
			seen.add(entry);
			uniqueEntries.push(entry);
		});

		if (uniqueEntries.length === 0) {
			return '<div class="schedule-location"></div>';
		}

		const entriesHtml = uniqueEntries.map(entry => {
			const parts = buildParts(entry);
			const detailHtml = parts.detail ? `<span class="location-detail">${parts.detail}</span>` : '';
			return `<div class="location-entry"><span class="location-main">${parts.main}</span>${detailHtml}</div>`;
		}).join('');

		return `<div class="schedule-location multi">${entriesHtml}</div>`;
	}
	
	const parts = buildParts(location);
	const detailHtml = parts.detail ? `<span class="location-detail">${parts.detail}</span>` : '';
	return `<div class="schedule-location">
		<span class="location-main">${parts.main}</span>
		${detailHtml}
	</div>`;
}

// 从课程数据构建时间段信息
function buildTimeSlots() {
	const { nodesLst, courses } = ScheduleData;
	
	if (!nodesLst || nodesLst.length === 0 || !courses || courses.length === 0) {
		return [];
	}
	
	// 从课程数据中提取时间映射
	const timeMapping = new Map();
	courses.forEach(course => {
		if (course.startTime && course.endTIme && course.classTime) {
			const timePart = course.classTime.substring(1);
			const timeDigits = timePart.match(/\d{2}/g) || [];
			if (timeDigits.length >= 2) {
				const key = `${timeDigits[0]}-${timeDigits[timeDigits.length - 1]}`;
				timeMapping.set(key, `${course.startTime}-${course.endTIme}`);
			}
		}
	});
	
	// 按节次分组（每2节为一组）
	const slots = [];
	for (let i = 0; i < nodesLst.length; i += 2) {
		if (i + 1 < nodesLst.length) {
			const node1 = nodesLst[i];
			const node2 = nodesLst[i + 1];
			const rangeKey = `${node1.nodeNumber}-${node2.nodeNumber}`;
			const timeRange = timeMapping.get(rangeKey) || `${node1.nodeName}-${node2.nodeName}`;
			
			slots.push({
				name: timeRange,
				period: `${node1.nodeName}-${node2.nodeName}`,
				code: [node1.nodeNumber, node2.nodeNumber]
			});
		}
	}
	
	return slots;
}

// ==================== 数据加载 ====================

// 加载指定周次的课表数据
async function loadScheduleByWeek(weekNumber) {
	try {
		const jsonPath = `大二上课表/${weekNumber}.json`;
		console.log(`[课表加载] 尝试加载第 ${weekNumber} 周课表: ${jsonPath}`);
		
		const response = await fetch(jsonPath);
		
		// 检查响应状态
		if (!response.ok) {
			throw new Error(`HTTP ${response.status}: 文件不存在或无法访问`);
		}
		
		const data = await response.json();

		if (data.code !== '1' || !data.data || data.data.length === 0) {
			throw new Error('数据格式错误或数据为空');
		}

		const scheduleData = data.data[0];
		
		// 存储所有数据到全局对象
		ScheduleData.raw = scheduleData;
		ScheduleData.courses = scheduleData.courses || [];
		ScheduleData.nodesLst = scheduleData.nodesLst || [];
		ScheduleData.date = scheduleData.date || [];
		ScheduleData.week = scheduleData.week || weekNumber;
		ScheduleData.weekday = scheduleData.weekday || '';
		ScheduleData.topInfo = scheduleData.topInfo ? scheduleData.topInfo[0] : null;

		// 从 date 数组构建 weekDays（星期名称数组）
		// date 数组按 xqid (0-6) 排序，对应周日-周六
		if (ScheduleData.date && ScheduleData.date.length === 7) {
			ScheduleData.weekDays = new Array(7);
			ScheduleData.date.forEach(d => {
				const dayIndex = parseInt(d.xqid);
				ScheduleData.weekDays[dayIndex] = '周' + d.xqmc;
			});
		}
		
		// 构建时间段数据
		ScheduleData.timeSlots = buildTimeSlots();

		// 渲染课表
		renderScheduleList();

		// 获取一言
		fetchHitokoto();
		
		// 缓存成功加载的周次
		WeekManager.setCachedWeek(weekNumber);
		WeekManager.setLastLoadTime();
		
		// 计算并缓存数据哈希
		const dataHash = WeekManager.calculateHash(scheduleData);
		WeekManager.setCachedHash(dataHash);
		
		// 启动课程实时跟随（数据加载成功后）
		if (window.ScheduleLive) {
			window.ScheduleLive.start();
		}
		
		console.log(`[课表加载] ✓ 成功加载第 ${weekNumber} 周课表 (哈希: ${dataHash})`);
		return true;

	} catch (error) {
		console.error(`[课表加载] ✗ 加载第 ${weekNumber} 周课表失败:`, error.message);
		return false;
	}
}

// 智能加载课表（带回退机制）
async function loadSchedule() {
	console.log('[课表加载] 开始智能加载课表...');
	
	// 1. 检查是否应该尝试加载下周数据（周末全天）
	if (WeekManager.shouldCheckNextWeek()) {
		const cachedWeek = WeekManager.getCachedWeek();
		if (cachedWeek) {
			const nextWeek = cachedWeek + 1;
			console.log(`[课表加载] 周末检查：尝试加载下周 (第 ${nextWeek} 周)`);
			
			const success = await loadScheduleByWeek(nextWeek);
			if (success) {
				console.log(`[课表加载] ✓ 成功切换到下周课表`);
				return;
			} else {
				console.log(`[课表加载] 下周课表不存在，继续使用当前周次`);
			}
		} else {
			// 如果没有缓存，尝试扫描最新的课表文件
			console.log(`[课表加载] 周末模式：没有缓存，扫描最新课表`);
			for (let week = 22; week >= 1; week--) {
				const success = await loadScheduleByWeek(week);
				if (success) {
					console.log(`[课表加载] ✓ 找到最新课表: 第 ${week} 周`);
					return;
				}
			}
		}
	}
	
	// 2. 尝试从缓存加载
	const cachedWeek = WeekManager.getCachedWeek();
	if (cachedWeek) {
		console.log(`[课表加载] 尝试从缓存加载: 第 ${cachedWeek} 周`);
		const success = await loadScheduleByWeek(cachedWeek);
		if (success) {
			return;
		}
		console.log(`[课表加载] 缓存的周次加载失败，尝试扫描可用文件`);
	}
	
	// 3. 扫描可用的课表文件 (从最新到最旧)
	console.log(`[课表加载] 扫描可用的课表文件...`);
	for (let week = 22; week >= 1; week--) {
		const success = await loadScheduleByWeek(week);
		if (success) {
			console.log(`[课表加载] ✓ 找到可用课表: 第 ${week} 周`);
			return;
		}
	}
	
	// 4. 所有尝试都失败
	console.error('[课表加载] ✗ 无法加载任何课表数据');
	document.getElementById('scheduleBody').innerHTML = 
		'<tr><td style="padding: 40px; text-align: center; color: rgba(255,255,255,0.6);">无法加载课表数据<br>请确保课表文件存在于 大二上课表/ 目录</td></tr>';
}

// 启动自动检查下周课表的定时器
function startAutoWeekCheck() {
	// 清除旧定时器
	WeekManager.clearTimer();
	
	// 每30分钟检查一次
	WeekManager.autoUpdateTimer = setInterval(() => {
		// 周末检查下周课表
		if (WeekManager.shouldCheckNextWeek()) {
			console.log('[自动检查] 触发周末课表检查');
			loadSchedule();
		}
		// 工作日检查调课
		else if (WeekManager.shouldCheckCourseChange()) {
			console.log('[自动检查] 触发工作日调课检查');
			checkCourseChange();
		}
	}, WeekManager.checkIntervalMinutes * 60 * 1000);
	
	console.log(`[自动检查] 已启动，每 ${WeekManager.checkIntervalMinutes} 分钟检查一次`);
}

// 检查当周课表是否有调课
async function checkCourseChange() {
	const currentWeek = WeekManager.getCachedWeek();
	if (!currentWeek) {
		console.log('[调课检查] 无缓存周次，跳过检查');
		return;
	}
	
	console.log(`[调课检查] 开始检查第 ${currentWeek} 周是否有调课...`);
	
	try {
		const jsonPath = `大二上课表/${currentWeek}.json`;
		const response = await fetch(jsonPath, {
			cache: 'no-cache' // 强制从服务器获取最新数据
		});
		
		if (!response.ok) {
			console.log('[调课检查] 文件不存在或无法访问');
			return;
		}
		
		const data = await response.json();
		
		if (data.code !== '1' || !data.data || data.data.length === 0) {
			console.log('[调课检查] 数据格式错误');
			return;
		}
		
		const scheduleData = data.data[0];
		
		// 计算新数据的哈希
		const newHash = WeekManager.calculateHash(scheduleData);
		const oldHash = WeekManager.getCachedHash();
		
		console.log(`[调课检查] 哈希对比 - 旧: ${oldHash}, 新: ${newHash}`);
		
		// 如果哈希不同，说明课表有变化
		if (newHash !== oldHash) {
			console.log('[调课检查] ⚠️ 检测到课表变化，重新加载数据');
			
			// 显示提示
			showCourseChangeNotification();
			
			// 重新加载课表
			await loadScheduleByWeek(currentWeek);
		} else {
			console.log('[调课检查] ✓ 课表无变化');
			// 更新最后检查时间，但不更新哈希
			WeekManager.setLastLoadTime();
		}
		
	} catch (error) {
		console.error('[调课检查] 检查失败:', error.message);
	}
}

// 显示课表变更通知
function showCourseChangeNotification() {
	// 创建通知元素
	const notification = document.createElement('div');
	notification.className = 'course-change-notification';
	notification.innerHTML = `
		<div class="notification-content">
			<span class="notification-icon">⚠️</span>
			<span class="notification-text">检测到课表更新，正在刷新...</span>
		</div>
	`;
	
	// 添加样式
	notification.style.cssText = `
		position: fixed;
		top: 100px;
		right: 40px;
		background: linear-gradient(135deg, rgba(255,160,0,0.95) 0%, rgba(255,120,0,0.95) 100%);
		color: white;
		padding: 16px 24px;
		border-radius: 12px;
		box-shadow: 0 8px 32px rgba(255,140,0,0.4);
		z-index: 10000;
		font-size: 16px;
		font-weight: 500;
		animation: slideInRight 0.5s ease;
		backdrop-filter: blur(10px);
	`;
	
	document.body.appendChild(notification);
	
	// 3秒后移除
	setTimeout(() => {
		notification.style.animation = 'slideOutRight 0.5s ease';
		setTimeout(() => {
			notification.remove();
		}, 500);
	}, 3000);
}

// ==================== 工具函数 ====================

// 获取一言 - 优化版：支持动态字体大小
async function fetchHitokoto() {
	const quoteElement = document.getElementById('scheduleQuote');
	if (!quoteElement) return;
	
	quoteElement.classList.add('loading');
	
	try {
		const response = await fetch('https://v1.hitokoto.cn/?encode=json');
		const data = await response.json();
		
		// 计算句子长度并动态调整字体大小
		const sentence = data.hitokoto || '愿你的每一天都充满阳光';
		const author = data.from || '';
		const sentenceLength = sentence.length;
		
		// 动态字体大小：根据句子长度调整（15-30字为基准18px，更长则缩小，更短则放大）
		let fontSize = 100; // 百分比
		if (sentenceLength <= 15) {
			fontSize = 120; // 短句放大
		} else if (sentenceLength <= 25) {
			fontSize = 110;
		} else if (sentenceLength <= 35) {
			fontSize = 100; // 基准大小
		} else if (sentenceLength <= 45) {
			fontSize = 90;
		} else if (sentenceLength <= 55) {
			fontSize = 82;
		} else {
			fontSize = 75; // 长句缩小
		}
		
		// 构建HTML：严格分两行，句子在上，出处在下
		let quoteHtml = `<div class="quote-content">
			<div class="quote-sentence" style="font-size: ${fontSize}%;">"${sentence}"</div>`;
		
		if (author) {
			quoteHtml += `<div class="quote-author">—— ${author}</div>`;
		}
		
		quoteHtml += `</div>`;
		
		quoteElement.innerHTML = quoteHtml;
		quoteElement.classList.remove('loading');
	} catch (error) {
		quoteElement.innerHTML = `<div class="quote-content">
			<div class="quote-sentence" style="font-size: 100%;">愿你的每一天都充满阳光</div>
		</div>`;
		quoteElement.classList.remove('loading');
	}
}

// ==================== 渲染函数 ====================

// 渲染课表列表
function renderScheduleList() {
	const tbody = document.getElementById('scheduleBody');
	tbody.innerHTML = '';

	const { courses, timeSlots, weekDays } = ScheduleData;
	
	if (!courses || courses.length === 0) {
		tbody.innerHTML = '<tr><td colspan="8" class="empty-cell">本周暂无课程</td></tr>';
		return;
	}

	// 获取今天是周几
	const today = new Date().getDay();
	
	// 按星期分组课程
	const coursesByDay = {};
	
	courses.forEach(course => {
		const weekDay = parseInt(course.weekDay);
		const classTime = course.classTime || '';
		
		if (classTime.length < 3) return;
		
		// 提取时间段
		const timePart = classTime.substring(1);
		const timeDigits = timePart.match(/\d{2}/g) || [];
		
		if (timeDigits.length === 0) return;
		
		// 使用课程本身的时间信息
		let timeSlotName = course.startTime && course.endTIme 
			? `${course.startTime}-${course.endTIme}`
			: '';
		
		let matchedSlotIndex = timeSlots.findIndex(slot => 
			slot.code.some(code => timeDigits.includes(code))
		);
		
		if (!timeSlotName && matchedSlotIndex !== -1) {
			timeSlotName = timeSlots[matchedSlotIndex].name;
		}
		
		if (timeSlotName && matchedSlotIndex !== -1) {
			if (!coursesByDay[weekDay]) {
				coursesByDay[weekDay] = [];
			}
			coursesByDay[weekDay].push({
				timeSlot: { name: timeSlotName },
				course: course,
				sortTime: matchedSlotIndex
			});
		}
	});

	// 转换为数组并排序
	const dayItems = Object.keys(coursesByDay).map(weekDay => {
		const dayNum = parseInt(weekDay);
		const dayCourses = coursesByDay[weekDay].sort((a, b) => a.sortTime - b.sortTime);
		
		return {
			weekDay: dayNum,
			weekDayName: weekDays[dayNum],
			courses: dayCourses,
			isToday: dayNum === today
		};
	}).sort((a, b) => a.weekDay - b.weekDay);

	// 渲染每天的课程
	if (dayItems.length === 0) {
		tbody.innerHTML = '<tr><td colspan="8" class="empty-cell">本周暂无课程</td></tr>';
		return;
	}

	// 获取当前时间用于判断课程是否完成
	const currentMinutes = new Date().getHours() * 60 + new Date().getMinutes();
	
	dayItems.forEach((dayItem, index) => {
		const tr = document.createElement('tr');
		const td = document.createElement('td');
		
		// 判断是否应该标记为已完成
		let isCompleted = false;
		if (dayItem.weekDay < today) {
			// 本周已经过去的日期
			isCompleted = true;
		} else if (dayItem.weekDay === today) {
			// 今天：检查是否所有课程都已结束
			const allCoursesEnded = dayItem.courses.every(item => {
				const endTime = item.course.endTIme;
				if (!endTime) return false;
				const [hours, minutes] = endTime.split(':').map(Number);
				const endMinutes = hours * 60 + minutes;
				return currentMinutes > endMinutes;
			});
			isCompleted = allCoursesEnded;
		}
		
		// 设置基础类名
		let className = 'schedule-item';
		if (dayItem.isToday) {
			className += ' schedule-item-today';
		}
		if (isCompleted) {
			className += ' day-completed';
		}
		
		td.className = className;
		td.style.animationDelay = `${0.15 + index * 0.08}s`;
		
		// 合并同一课程的不同时间段
		const mergedCourses = mergeSameCourses(dayItem.courses);
		
		// 生成课程列表HTML
		const coursesHtml = mergedCourses.map(item => {
			const sessions = item.sessions ?? [{ time: item.time, location: item.location }].filter(Boolean);
			let isFinished = false;
			if (dayItem.weekDay < today) {
				isFinished = true;
			} else if (dayItem.weekDay === today) {
				isFinished = sessions.every(session => {
					if (!session || !session.time) {
						return false;
					}
					const parts = session.time.split('-');
					const end = parts.length > 1 ? parts[parts.length - 1] : '';
					if (!end) {
						return false;
					}
					return currentMinutes > timeStringToMinutes(end.trim());
				});
			}

			if (item.sessions && item.sessions.length > 1) {
				const sessionsHtml = item.sessions.map(session => 
					`<div class="course-session">${session.time} · ${session.location}</div>`
				).join('');
				return `
					<div style="margin-bottom: 12px;">
						<div class="course-name${isFinished ? ' course-finished' : ''}">${item.courseName}</div>
						<div class="course-detail${isFinished ? ' course-finished' : ''}">${item.teacher}</div>
						<div class="course-sessions">${sessionsHtml}</div>
					</div>
				`;
			} else {
				return `
					<div style="margin-bottom: 12px;">
						<div class="course-name${isFinished ? ' course-finished' : ''}">${item.courseName}</div>
						<div class="course-detail${isFinished ? ' course-finished' : ''}">${item.time} · ${item.teacher}</div>
					</div>
				`;
			}
		}).join('');

		const locationEntries = [];
		mergedCourses.forEach(item => {
			if (item.sessions && item.sessions.length > 0) {
				item.sessions.forEach(session => {
					if (session.location) {
						locationEntries.push(session.location);
					}
				});
			} else if (item.location) {
				locationEntries.push(item.location);
			}
		});

		const locationHtml = formatLocation(locationEntries);
		
		td.innerHTML = `
			<div class="schedule-time" style="font-weight: ${dayItem.isToday ? '800' : '800'}; opacity: ${dayItem.isToday ? '1' : '0.85'};">
				${dayItem.weekDayName}
			</div>
			<div class="schedule-course">
				${coursesHtml}
			</div>
			${locationHtml}
		`;
		
		tr.appendChild(td);
		tbody.appendChild(tr);
	});
}

// 合并同一课程的不同时间段 - 使用 ScheduleData 中的数据
function mergeSameCourses(dayCourses) {
	const merged = {};
	
	dayCourses.forEach(item => {
		// 使用课程名和教师名作为唯一标识
		const key = `${item.course.courseName}_${item.course.teacherName}`;
		
		if (!merged[key]) {
			merged[key] = {
				courseName: item.course.courseName,
				teacher: item.course.teacherName,
				sessions: []
			};
		}
		
		// 添加课程时间段信息
		merged[key].sessions.push({
			time: `${item.course.startTime}-${item.course.endTIme}`,
			location: item.course.classroomName,
			sortTime: item.course.startTime // 使用 startTime 进行排序
		});
	});
	
	// 转换为数组并处理
	return Object.values(merged).map(item => {
		// 按时间排序
		item.sessions.sort((a, b) => a.sortTime.localeCompare(b.sortTime));
		
		// 如果只有一个时间段，简化显示
		if (item.sessions.length === 1) {
			return {
				courseName: item.courseName,
				teacher: item.teacher,
				time: item.sessions[0].time,
				location: item.sessions[0].location
			};
		}
		
		// 多个时间段，保留 sessions 数组
		return item;
	});
}

// 初始化课表功能
function initSchedule() {
	let scheduleVisible = false;
	let isScheduleRendered = false; // 标记课表是否已渲染
	const scheduleContainer = document.getElementById('scheduleContainer');
	const scheduleTrigger = document.getElementById('scheduleTrigger');

	if (!scheduleContainer || !scheduleTrigger) {
		return;
	}

	// 双击检测
	let clickTimer = null;
	let clickCount = 0;
	let isToggling = false; // 防止重复触发

	scheduleTrigger.addEventListener('click', function(e) {
		e.preventDefault();
		e.stopPropagation();
		
		// 如果正在切换状态，忽略点击
		if (isToggling) {
			return;
		}
		
		clickCount++;
		
		if (clickTimer) {
			clearTimeout(clickTimer);
		}
		
		// 300ms内的第二次点击视为双击
		if (clickCount === 2) {
			clickCount = 0;
			toggleSchedule();
		} else {
			clickTimer = setTimeout(() => {
				clickCount = 0;
			}, 300);
		}
	});

	// 课表容器单击事件 - 阻止事件冒泡，不关闭课表
	scheduleContainer.addEventListener('click', function(e) {
		// 只阻止事件冒泡，让用户可以与课表内容交互
		e.stopPropagation();
	});

	// 切换课表显示状态
	async function toggleSchedule() {
		// 防止重复触发
		if (isToggling) {
			return;
		}
		
		isToggling = true;
		
		try {
			if (!scheduleVisible) {
				// 展开前先获取一言数据，避免展开后才刷新
				await fetchHitokoto();
				
				scheduleVisible = true;
				scheduleContainer.classList.add('visible');
				scheduleTrigger.classList.add('hidden');
				
				// 只在首次打开时启动实时跟随
				if (!isScheduleRendered && window.ScheduleLive) {
					// 标记已渲染
					isScheduleRendered = true;
					// 等待动画完成后再启动实时跟随
					setTimeout(() => {
						window.ScheduleLive.start();
					}, 650);
				}
			} else {
				scheduleVisible = false;
				scheduleContainer.classList.remove('visible');
				scheduleTrigger.classList.remove('hidden');
			}
		} catch (error) {
			console.error('切换课表时出错:', error);
		} finally {
			// 无论成功还是失败，都要重置标志
			// 动画完成后才允许下次切换（500ms 是动画时间）
			setTimeout(() => {
				isToggling = false;
			}, 500);
		}
	}

	// 点击页面其他地方关闭课表
	document.addEventListener('click', function(e) {
		if (scheduleVisible) {
			const isClickInsideSchedule = scheduleContainer.contains(e.target);
			const isClickInsideTrigger = scheduleTrigger.contains(e.target);
			
			if (!isClickInsideSchedule && !isClickInsideTrigger) {
				scheduleVisible = false;
				scheduleContainer.classList.remove('visible');
				scheduleTrigger.classList.remove('hidden');
			}
		}
	});

	// 加载课表数据
	loadSchedule();
	
	// 启动自动周次检查（周末晚上8点自动检查下周课表）
	startAutoWeekCheck();
}

// 页面加载完成后初始化
if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', initSchedule);
} else {
	initSchedule();
}
