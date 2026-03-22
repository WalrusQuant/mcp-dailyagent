export interface DaySummary {
  tasks: {
    total: number;
    done: number;
    hasA: boolean;
    hasB: boolean;
    hasC: boolean;
  };
  habits: {
    total: number;
    completed: number;
    colors: string[];
  };
  journal: {
    hasEntry: boolean;
    mood: number | null;
  };
  workouts: {
    count: number;
  };
  focus: {
    sessions: number;
    minutes: number;
  };
}

export interface DayDetailTask {
  id: string;
  title: string;
  priority: string;
  done: boolean;
}

export interface DayDetailHabit {
  name: string;
  color: string;
  completed: boolean;
}

export interface DayDetailJournal {
  id: string;
  mood: number | null;
  content: string;
}

export interface DayDetailWorkout {
  id: string;
  name: string;
  duration_minutes: number | null;
}

export interface DayDetailFocus {
  id: string;
  duration_minutes: number;
  task_title: string | null;
  status: string;
}

export interface DayDetail {
  date: string;
  tasks: DayDetailTask[];
  habits: DayDetailHabit[];
  journal: DayDetailJournal | null;
  workouts: DayDetailWorkout[];
  focus: DayDetailFocus[];
}
