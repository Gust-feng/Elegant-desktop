// ==================== 课表实时跟随系统 ====================
// 用于实时检测当前课程状态并提供优雅的视觉提醒
// 独立文件管理，便于后续扩展

// 实时跟随状态
const LiveStatus = {
	currentCourse: null,     // 当前正在上的课
	nextCourse: null,        // 下一节课
	tomorrowCourses: [],     // 明天的课程
	updateTimer: null,       // 更新定时器
	timeoutHandles: []       // 存储所有的 setTimeout 句柄，用于清理
};

// ==================== 时间工具函数 ====================

// 解析时间字符串为分钟数（从00:00开始计算）
function parseTimeToMinutes(timeStr) {
	if (!timeStr) return 0;
	const [hours, minutes] = timeStr.split(':').map(Number);
	return hours * 60 + minutes;
}

// 获取当前时间的分钟数
function getCurrentMinutes() {
	const now = new Date();
	return now.getHours() * 60 + now.getMinutes();
}

// 计算时间差（分钟）
function getTimeDifference(targetTime) {
	const current = getCurrentMinutes();
	const target = parseTimeToMinutes(targetTime);
	return target - current;
}

// 格式化时间差为可读文本
function formatTimeDifference(minutes) {
	if (minutes < 0) return '';
	if (minutes === 0) return '即将开始';
	if (minutes < 60) {
		return `${minutes}分钟`;
	}
	const hours = Math.floor(minutes / 60);
	const mins = minutes % 60;
	if (mins === 0) {
		return `${hours}小时`;
	}
	// 超过1小时的，只显示小时数，更简洁
	if (hours >= 2) {
		return `${hours}小时`;
	}
	// 1-2小时之间显示详细时间
	return `${hours}小时${mins}分`;
}

// ==================== 课程状态检测 ====================

// 检测当前课程状态
function detectCourseStatus() {
	if (!ScheduleData.courses || ScheduleData.courses.length === 0) {
		return null;
	}

	const now = new Date();
	const currentDay = now.getDay(); // 0-6，周日到周六
	const currentMinutes = getCurrentMinutes();

	// 获取今天的课程
	const todayCourses = ScheduleData.courses
		.filter(course => parseInt(course.weekDay) === currentDay)
		.map(course => ({
			...course,
			startMinutes: parseTimeToMinutes(course.startTime),
			endMinutes: parseTimeToMinutes(course.endTIme)
		}))
		.sort((a, b) => a.startMinutes - b.startMinutes);

	// 获取明天的课程
	const tomorrowDay = (currentDay + 1) % 7;
	const tomorrowCourses = ScheduleData.courses
		.filter(course => parseInt(course.weekDay) === tomorrowDay)
		.map(course => ({
			...course,
			startMinutes: parseTimeToMinutes(course.startTime),
			endMinutes: parseTimeToMinutes(course.endTIme)
		}))
		.sort((a, b) => a.startMinutes - b.startMinutes);

	// 检查是否正在上课
	const currentCourse = todayCourses.find(course => 
		currentMinutes >= course.startMinutes && currentMinutes <= course.endMinutes
	);

	if (currentCourse) {
		return {
			status: 'in-class',
			course: currentCourse,
			remainingMinutes: currentCourse.endMinutes - currentMinutes
		};
	}

	// 检查是否有即将开始的课程
	const nextCourse = todayCourses.find(course => 
		currentMinutes < course.startMinutes
	);

	if (nextCourse) {
		const minutesUntil = nextCourse.startMinutes - currentMinutes;
		return {
			status: 'upcoming',
			course: nextCourse,
			minutesUntil: minutesUntil
		};
	}

	// 今天没有课了，返回明天的课程
	if (tomorrowCourses.length > 0) {
		return {
			status: 'tomorrow',
			courses: tomorrowCourses
		};
	}

	// 没有课程
	return {
		status: 'no-class'
	};
}

// ==================== 视觉标记函数 ====================

// 为课程添加实时状态标记
function applyCourseStatusMarkers() {
	const status = detectCourseStatus();
	if (!status) return;

	// 查找现有标记，判断是否需要更新
	const existingMarkers = document.querySelectorAll('.course-status-marker');
	const existingStatus = existingMarkers.length > 0 ? 
		(document.querySelector('.course-item-highlight.in-class') ? 'in-class' :
		 document.querySelector('.course-item-highlight.upcoming') ? 'upcoming' :
		 document.querySelector('.course-item-highlight.tomorrow') ? 'tomorrow' : null) : null;

	// 如果状态没有改变，只更新时间数值
	if (existingStatus === status.status && (status.status === 'in-class' || status.status === 'upcoming')) {
		updateTimeValues(status);
		return;
	}

	// 状态改变了，清除所有标记
	document.querySelectorAll('.course-status-marker').forEach(el => el.remove());
	document.querySelectorAll('.course-item-highlight').forEach(el => {
		el.classList.remove('course-item-highlight', 'in-class', 'upcoming', 'tomorrow');
	});

	// 根据状态添加标记
	switch (status.status) {
		case 'in-class':
			markCurrentCourse(status.course);
			break;
		case 'upcoming':
			markUpcomingCourse(status.course, status.minutesUntil);
			break;
		case 'tomorrow':
			markTomorrowCourses(status.courses);
			break;
	}

	// 标记已完成的课程
	markCompletedCourses();
	
	// 清除新一周的完成标记
	clearCompletedMarks();
}

// 平滑更新时间数值（避免闪烁）
function updateTimeValues(status) {
	// 查找所有时间值元素（不限定在 time-desc 内）
	const timeValueElements = document.querySelectorAll('.time-value');
	
	if (status.status === 'in-class' && status.remainingMinutes !== undefined) {
		const timeText = formatTimeDifference(status.remainingMinutes);
		timeValueElements.forEach(el => {
			if (el.textContent !== timeText) {
				// 使用平滑过渡
				el.style.transition = 'opacity 0.3s ease';
				el.style.opacity = '0.5';
				const handle = setTimeout(() => {
					el.textContent = timeText;
					el.style.opacity = '1';
				}, 150);
				LiveStatus.timeoutHandles.push(handle);
			}
		});
	} else if (status.status === 'upcoming' && status.minutesUntil !== undefined) {
		const timeText = formatTimeDifference(status.minutesUntil);
		timeValueElements.forEach(el => {
			if (el.textContent !== timeText) {
				// 使用平滑过渡
				el.style.transition = 'opacity 0.3s ease';
				el.style.opacity = '0.5';
				const handle = setTimeout(() => {
					el.textContent = timeText;
					el.style.opacity = '1';
				}, 150);
				LiveStatus.timeoutHandles.push(handle);
			}
		});
	}
}

// 标记正在上的课程
function markCurrentCourse(course) {
	const courseElements = findCourseElements(course.courseName, course.teacherName, course.weekDay, course.startTime);
	const currentMinutes = getCurrentMinutes();
	const endMinutes = parseTimeToMinutes(course.endTIme);
	const remainingMinutes = endMinutes - currentMinutes;
	
	courseElements.forEach(element => {
		const courseDetail = element.querySelector('.course-detail');
		if (courseDetail) {
			// 添加高亮样式
			element.classList.add('course-item-highlight', 'in-class');
			
			// 添加状态标记
			const marker = document.createElement('div');
			marker.className = 'course-status-marker in-class-marker';
			
			// 显示剩余时间
			const timeText = formatTimeDifference(remainingMinutes);
			marker.innerHTML = `IN PROGRESS <span class="time-desc">· 还有 <span class="time-value">${timeText}</span> 下课</span>`;
			
			courseDetail.appendChild(marker);
		}
	});
}

// 标记即将开始的课程
function markUpcomingCourse(course, minutesUntil) {
	const courseElements = findCourseElements(course.courseName, course.teacherName, course.weekDay, course.startTime);
	courseElements.forEach(element => {
		const courseDetail = element.querySelector('.course-detail');
		if (courseDetail) {
			// 添加高亮样式
			element.classList.add('course-item-highlight', 'upcoming');
			
			// 添加状态标记
			const marker = document.createElement('div');
			marker.className = 'course-status-marker upcoming-marker';
			const timeText = formatTimeDifference(minutesUntil);
			
			// 显示距离上课时间
			let displayText = '';
			if (minutesUntil <= 5) {
				displayText = `STARTING <span class="time-desc">· 即将开始</span>`;
			} else {
				displayText = `<span class="time-desc">距离上课还有</span> <span class="time-value">${timeText}</span>`;
			}
			
			marker.innerHTML = displayText;
			courseDetail.appendChild(marker);
		}
	});
}

// 标记明天的课程（简洁左侧线条标识）
function markTomorrowCourses(courses) {
	if (courses.length === 0) return;

	// 找到明天对应的课表项
	const tomorrowDay = (new Date().getDay() + 1) % 7;
	const tomorrowItems = document.querySelectorAll('.schedule-item');
	
	tomorrowItems.forEach(item => {
		const weekDayText = item.querySelector('.schedule-time')?.textContent.trim();
		const tomorrowName = ScheduleData.weekDays[tomorrowDay];
		
		if (weekDayText === tomorrowName) {
			// 添加明天标识样式
			item.classList.add('course-item-highlight', 'tomorrow');
		}
	});
}

// 标记已完成的课程（本周所有已过去的日期）
function markCompletedCourses() {
	const now = new Date();
	const currentDay = now.getDay(); // 0-6，周日到周六
	const currentMinutes = getCurrentMinutes();

	const scheduleItems = document.querySelectorAll('.schedule-item');
	
	scheduleItems.forEach(item => {
		const weekDayText = item.querySelector('.schedule-time')?.textContent.trim();
		
		// 找到这个课表项对应的星期几
		const dayIndex = ScheduleData.weekDays.findIndex(day => day === weekDayText);
		if (dayIndex === -1) return;

		// 判断是否应该标记为已完成
		let shouldMarkCompleted = false;

		if (dayIndex < currentDay) {
			// 本周已经过去的日期（周一到昨天）
			shouldMarkCompleted = true;
		} else if (dayIndex === currentDay) {
			// 今天：检查是否所有课程都已结束
			const todayCourses = ScheduleData.courses
				.filter(course => parseInt(course.weekDay) === currentDay)
				.map(course => ({
					...course,
					endMinutes: parseTimeToMinutes(course.endTIme)
				}));

			// 如果今天有课程且所有课程都已结束
			if (todayCourses.length > 0) {
				const hasOngoingCourse = todayCourses.some(course => currentMinutes < course.endMinutes);
				shouldMarkCompleted = !hasOngoingCourse;
			}
		}

		// 添加或移除完成标记（只在状态改变时操作，避免闪烁）
		const hasCompletedClass = item.classList.contains('day-completed');
		if (shouldMarkCompleted && !hasCompletedClass) {
			item.classList.add('day-completed');
		} else if (!shouldMarkCompleted && hasCompletedClass) {
			item.classList.remove('day-completed');
		}
	});
}

// 清除已完成标记（在新的一周时调用）
function clearCompletedMarks() {
	const now = new Date();
	const currentDay = now.getDay();
	
	// 周一（1）时清除所有删除线
	if (currentDay === 1) {
		document.querySelectorAll('.day-completed').forEach(item => {
			item.classList.remove('day-completed');
		});
	}
}

// ==================== DOM 查找函数 ====================

// 查找匹配的课程元素（增加星期几和时间段的精确匹配）
function findCourseElements(courseName, teacherName, weekDay, startTime) {
	const results = [];
	const scheduleItems = document.querySelectorAll('.schedule-item');
	
	// 根据weekDay查找对应的schedule-item
	scheduleItems.forEach(item => {
		// 获取这个schedule-item对应的星期几
		const weekDayText = item.querySelector('.schedule-time')?.textContent.trim();
		const targetWeekDay = ScheduleData.weekDays[parseInt(weekDay)];
		
		// 只在对应的星期几中查找
		if (weekDayText === targetWeekDay) {
			const courseNameElements = item.querySelectorAll('.course-name');
			
			courseNameElements.forEach(nameEl => {
				if (nameEl.textContent.trim() === courseName) {
					// 检查教师名称和时间是否匹配
					const parent = nameEl.parentElement;
					const detailEl = parent.querySelector('.course-detail');
					
					if (detailEl && detailEl.textContent.includes(teacherName)) {
						// 如果提供了startTime，还要检查时间是否匹配
						if (startTime) {
							// 时间信息在 course-detail 或 course-session 中
							const detailText = detailEl.textContent;
							const sessionEls = parent.querySelectorAll('.course-session');
							let timeMatched = detailText.includes(startTime);
							
							// 如果有多个时间段，检查 course-session
							if (!timeMatched && sessionEls.length > 0) {
								sessionEls.forEach(sessionEl => {
									if (sessionEl.textContent.includes(startTime)) {
										timeMatched = true;
									}
								});
							}
							
							if (timeMatched) {
								results.push(parent);
							}
						} else {
							results.push(parent);
						}
					}
				}
			});
		}
	});
	
	return results;
}

// ==================== 初始化和更新 ====================

// 启动实时跟随
function startLiveTracking() {
	// 清理旧的定时器和超时句柄
	if (LiveStatus.updateTimer) {
		clearInterval(LiveStatus.updateTimer);
	}
	LiveStatus.timeoutHandles.forEach(handle => clearTimeout(handle));
	LiveStatus.timeoutHandles = [];
	
	// 立即执行一次
	applyCourseStatusMarkers();
	
	// 每30秒更新一次
	LiveStatus.updateTimer = setInterval(() => {
		applyCourseStatusMarkers();
	}, 30000); // 30秒
}

// 停止实时跟随
function stopLiveTracking() {
	// 清理定时器
	if (LiveStatus.updateTimer) {
		clearInterval(LiveStatus.updateTimer);
		LiveStatus.updateTimer = null;
	}
	
	// 清理所有 setTimeout 句柄
	LiveStatus.timeoutHandles.forEach(handle => clearTimeout(handle));
	LiveStatus.timeoutHandles = [];
	
	// 清除所有标记
	document.querySelectorAll('.course-status-marker').forEach(el => el.remove());
	document.querySelectorAll('.course-item-highlight').forEach(el => {
		el.classList.remove('course-item-highlight', 'in-class', 'upcoming', 'tomorrow');
	});
	document.querySelectorAll('.day-completed').forEach(el => {
		el.classList.remove('day-completed');
	});
}

// 手动刷新状态
function refreshLiveStatus() {
	applyCourseStatusMarkers();
}

// ==================== 导出接口 ====================
window.ScheduleLive = {
	start: startLiveTracking,
	stop: stopLiveTracking,
	refresh: refreshLiveStatus,
	getStatus: detectCourseStatus
};
