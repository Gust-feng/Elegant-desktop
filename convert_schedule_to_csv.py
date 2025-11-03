import json
import csv
import os
from datetime import datetime

def convert_schedule_to_csv(json_path, csv_path=None):
    """
    将课表JSON数据转换为CSV格式
    
    参数:
        json_path: JSON文件路径
        csv_path: 输出CSV文件路径，如果为None则自动生成
    """
    
    # 如果未指定CSV路径，自动生成
    if csv_path is None:
        base_name = os.path.splitext(os.path.basename(json_path))[0]
        dir_path = os.path.dirname(json_path)
        csv_path = os.path.join(dir_path, f"{base_name}_schedule.csv")
    
    try:
        # 读取JSON文件
        with open(json_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        # 提取课表数据
        if data.get('code') != '1' or not data.get('data'):
            print("错误：JSON数据格式不正确")
            return False
        
        schedule_data = data['data'][0]
        courses = schedule_data.get('courses', [])
        
        if not courses:
            print("警告：没有找到课程数据")
            return False
        
        # 准备CSV数据
        csv_data = []
        
        for course in courses:
            # 提取周次信息
            class_week = course.get('classWeek', '')
            
            # 提取时间信息
            start_time = course.get('startTime', '')
            end_time = course.get('endTIme', '')  # 注意：原始数据中是endTIme
            time_range = f"{start_time}-{end_time}" if start_time and end_time else ''
            
            # 提取课程名称
            course_name = course.get('courseName', '')
            
            # 提取教室信息
            classroom_name = course.get('classroomName', '')
            building_name = course.get('buildingName', '')
            location = classroom_name if classroom_name else building_name
            
            # 提取教师姓名
            teacher_name = course.get('teacherName', '')
            
            # 提取星期信息（如果有的话）
            week_day = course.get('weekDay', '')
            
            # 添加到CSV数据
            csv_data.append({
                '周次': class_week,
                '时间': time_range,
                '课名': course_name,
                '教室': location,
                '教师': teacher_name,
                '星期': week_day
            })
        
        # 写入CSV文件
        with open(csv_path, 'w', newline='', encoding='utf-8-sig') as f:
            fieldnames = ['周次', '时间', '课名', '教室', '教师', '星期']
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            
            writer.writeheader()
            writer.writerows(csv_data)
        
        print(f"成功：课表数据已转换为CSV格式")
        print(f"输入文件：{json_path}")
        print(f"输出文件：{csv_path}")
        print(f"共转换了 {len(csv_data)} 条课程记录")
        
        # 显示前几条数据作为示例
        if csv_data:
            print("\n前5条课程数据：")
            for i, row in enumerate(csv_data[:5]):
                print(f"{i+1}. {row['课名']} - {row['时间']} - {row['教室']} - {row['教师']}")
        
        return True
        
    except FileNotFoundError:
        print(f"错误：找不到文件 {json_path}")
        return False
    except json.JSONDecodeError:
        print(f"错误：JSON文件格式不正确 {json_path}")
        return False
    except Exception as e:
        print(f"错误：转换过程中发生异常 - {str(e)}")
        return False

def main():
    # 使用相对路径（脚本所在目录下的子目录）
    script_dir = os.path.dirname(os.path.abspath(__file__))
    default_json_path = os.path.join(script_dir, "大二上课表", "9.json")
    
    # 检查文件是否存在
    if not os.path.exists(default_json_path):
        print(f"错误：默认文件不存在 {default_json_path}")
        print("请修改脚本中的文件路径或提供正确的文件路径")
        print(f"当前脚本目录: {script_dir}")
        return
    
    # 执行转换
    success = convert_schedule_to_csv(default_json_path)
    
    if success:
        print("\n转换完成！")
    else:
        print("\n转换失败！")

if __name__ == "__main__":
    main()