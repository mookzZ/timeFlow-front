// app.jsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import styles from './App.module.css';

const API_BASE_URL = 'http://localhost:8000/tracker/api';

function App() {
    const [tasks, setTasks] = useState([]);
    const [newTaskName, setNewTaskName] = useState('');
    const intervalRefs = useRef({});

    const formatTime = (totalSeconds) => {
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        return [hours, minutes, seconds]
            .map(unit => String(unit).padStart(2, '0'))
            .join(':');
    };

    const fetchTasks = useCallback(async () => {
        try {
            const response = await axios.get(`${API_BASE_URL}/tasks/`);
            const updatedTasks = response.data.map(task => {
                if (!task.isRunning && intervalRefs.current[task.id]) {
                    clearInterval(intervalRefs.current[task.id]);
                    delete intervalRefs.current[task.id];
                }
                return task;
            });
            setTasks(updatedTasks);
        } catch (error) {
            console.error('Error fetching tasks:', error);
        }
    }, []);

    const addTask = async () => {
        if (newTaskName.trim() === '') return;

        try {
            const response = await axios.post(`${API_BASE_URL}/tasks/`, { name: newTaskName });
            setTasks((prevTasks) => [...prevTasks, response.data]);
            setNewTaskName('');
        } catch (error) {
            console.error('Error adding task:', error);
        }
    };

    const toggleTaskTimer = async (id) => {
        try {
            const response = await axios.post(`${API_BASE_URL}/tasks/${id}/toggle/`);
            setTasks((prevTasks) =>
                prevTasks.map((task) => {
                    if (task.id === id) {
                        return response.data;
                    }
                    if (task.id !== id && task.isRunning && intervalRefs.current[task.id]) {
                        clearInterval(intervalRefs.current[task.id]);
                        delete intervalRefs.current[task.id];
                        return { ...task, isRunning: false };
                    }
                    return task;
                })
            );

            const updatedTask = response.data;
            if (updatedTask.isRunning) {
                if (!intervalRefs.current[id]) {
                    intervalRefs.current[id] = setInterval(() => {
                        setTasks((currentTasks) =>
                            currentTasks.map((t) =>
                                t.id === id ? { ...t, timeElapsed: t.timeElapsed + 1 } : t
                            )
                        );
                    }, 1000);
                }
            } else {
                if (intervalRefs.current[id]) {
                    clearInterval(intervalRefs.current[id]);
                    delete intervalRefs.current[id];
                }
            }

        } catch (error) {
            console.error('Error toggling timer:', error);
        }
    };

    const completeTask = async (id) => {
        try {
            const response = await axios.post(`${API_BASE_URL}/tasks/${id}/complete/`);
            setTasks((prevTasks) =>
                prevTasks.map((task) =>
                    task.id === id ? response.data : task
                )
            );
            if (intervalRefs.current[id]) {
                clearInterval(intervalRefs.current[id]);
                delete intervalRefs.current[id];
            }
        } catch (error) {
            console.error('Error completing task:', error);
        }
    };

    const deleteTask = async (id) => {
        try {
            await axios.delete(`${API_BASE_URL}/tasks/${id}/delete/`);
            setTasks((prevTasks) => prevTasks.filter((task) => task.id !== id));
            if (intervalRefs.current[id]) {
                clearInterval(intervalRefs.current[id]);
                delete intervalRefs.current[id];
            }
        } catch (error) {
            console.error('Error deleting task:', error);
        }
    };

    useEffect(() => {
        fetchTasks();
    }, [fetchTasks]);

    useEffect(() => {
        return () => {
            for (const id in intervalRefs.current) {
                clearInterval(intervalRefs.current[id]);
            }
        };
    }, []);

    useEffect(() => {
        tasks.forEach(task => {
            if (task.isRunning && !intervalRefs.current[task.id]) {
                intervalRefs.current[task.id] = setInterval(() => {
                    setTasks(currentTasks =>
                        currentTasks.map(t =>
                            t.id === task.id ? { ...t, timeElapsed: t.timeElapsed + 1 } : t
                        )
                    );
                }, 1000);
            } else if (!task.isRunning && intervalRefs.current[task.id]) {
                clearInterval(intervalRefs.current[task.id]);
                delete intervalRefs.current[task.id];
            }
        });

        return () => {};
    }, [tasks]);


    return (
        <div className={styles.container}>
            <div className={styles.trackerCard}>
                <h1 className={styles.title}>Тайм-трекер</h1>

                <div className={styles.inputGroup}>
                    <input
                        type="text"
                        className={styles.inputField}
                        placeholder="Название новой задачи..."
                        value={newTaskName}
                        onChange={(e) => setNewTaskName(e.target.value)}
                        onKeyPress={(e) => {
                            if (e.key === 'Enter') {
                                addTask();
                            }
                        }}
                    />
                    <button
                        onClick={addTask}
                        className={styles.createButton}
                    >
                        Создать
                    </button>
                </div>

                {tasks.length === 0 ? (
                    <p className={styles.noTasksMessage}>Задач пока нет. Добавьте первую!</p>
                ) : (
                    <ul className={styles.taskList}>
                        {tasks.map((task) => (
                            <li
                                key={task.id}
                                className={`${styles.taskItem} ${task.isCompleted ? styles.taskCompleted : ''}`}
                            >
                                <div className={styles.taskName}>
                                    {task.name}
                                </div>
                                <div className={styles.taskControlsGroup}>
                                    <span className={styles.taskTime}>
                                        {formatTime(task.timeElapsed)}
                                    </span>
                                    {!task.isCompleted && (
                                        <>
                                            <button
                                                onClick={() => toggleTaskTimer(task.id)}
                                                className={`${styles.controlButton} ${
                                                    task.isRunning ? styles.pauseButton : styles.startButton
                                                }`}
                                                title={task.isRunning ? 'Пауза' : 'Старт'}
                                            >
                                                {task.isRunning ? (
                                                    <svg
                                                        xmlns="http://www.w3.org/2000/svg"
                                                        className="h-5 w-5"
                                                        viewBox="0 0 20 20"
                                                        fill="currentColor"
                                                    >
                                                        <path
                                                            fillRule="evenodd"
                                                            d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z"
                                                            clipRule="evenodd"
                                                        />
                                                    </svg>
                                                ) : (
                                                    <svg
                                                        xmlns="http://www.w3.org/2000/svg"
                                                        className="h-5 w-5"
                                                        viewBox="0 0 20 20"
                                                        fill="currentColor"
                                                    >
                                                        <path
                                                            fillRule="evenodd"
                                                            d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z"
                                                            clipRule="evenodd"
                                                        />
                                                    </svg>
                                                )}
                                            </button>
                                            <button
                                                onClick={() => completeTask(task.id)}
                                                className={`${styles.controlButton} ${styles.completeButton}`}
                                                title="Завершить"
                                            >
                                                <svg
                                                    xmlns="http://www.w3.org/2000/svg"
                                                    className="h-5 w-5"
                                                    viewBox="0 0 20 20"
                                                    fill="currentColor"
                                                >
                                                    <path
                                                        fillRule="evenodd"
                                                        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                                                        clipRule="evenodd"
                                                    />
                                                </svg>
                                            </button>
                                        </>
                                    )}
                                    {task.isCompleted && (
                                        <button
                                            onClick={() => deleteTask(task.id)}
                                            className={`${styles.controlButton} ${styles.deleteButton}`}
                                            title="Удалить"
                                        >
                                            <svg
                                                xmlns="http://www.w3.org/2000/svg"
                                                className="h-5 w-5"
                                                viewBox="0 0 20 20"
                                                fill="currentColor"
                                            >
                                                <path
                                                    fillRule="evenodd"
                                                    d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm6 0a1 1 0 11-2 0v6a1 1 0 112 0V8z"
                                                    clipRule="evenodd"
                                                />
                                            </svg>
                                        </button>
                                    )}
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
}

export default App;