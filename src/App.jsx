// app.jsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import styles from './App.module.css';

// Обновленный API_BASE_URL в соответствии с вашими настройками
const API_BASE_URL = 'http://localhost:8000/tracker';

function App() {
    const [tasks, setTasks] = useState([]);
    const [newTaskName, setNewTaskName] = useState('');
    const intervalRefs = useRef({});

    // Состояния для аутентификации
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [email, setEmail] = useState(''); // Для регистрации
    const [isRegistering, setIsRegistering] = useState(false); // Для переключения между формами входа/регистрации
    const [authMessage, setAuthMessage] = useState(''); // Сообщения об успешной/неудачной аутентификации
    const [currentUsername, setCurrentUsername] = useState(''); // Добавлено: для хранения имени текущего пользователя

    // Убедитесь, что axios отправляет куки с каждым запросом (для работы сессий Django)
    axios.defaults.withCredentials = true;

    // --- Функции форматирования и утилиты ---
    const formatTime = (totalSeconds) => {
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        return [hours, minutes, seconds]
            .map(unit => String(unit).padStart(2, '0'))
            .join(':');
    };

    // --- Функции аутентификации ---
    const handleLogin = async (e) => {
        e.preventDefault();
        setAuthMessage(''); // Сброс сообщений
        try {
            const response = await axios.post(`${API_BASE_URL}/auth/login/`, { username, password });
            if (response.status === 200) {
                setIsAuthenticated(true);
                setCurrentUsername(response.data.username); // Устанавливаем имя пользователя из ответа
                setAuthMessage('Вход выполнен успешно!');
                setUsername('');
                setPassword('');
                fetchTasks(); // Загружаем задачи после успешного входа
            }
        } catch (error) {
            console.error('Ошибка входа:', error);
            setAuthMessage(error.response?.data?.error || 'Неверное имя пользователя или пароль.');
        }
    };

    const handleRegister = async (e) => {
        e.preventDefault();
        setAuthMessage(''); // Сброс сообщений
        try {
            const response = await axios.post(`${API_BASE_URL}/auth/register/`, { username, email, password });
            if (response.status === 201) {
                setAuthMessage('Регистрация прошла успешно! Теперь вы можете войти.');
                setIsRegistering(false); // Переключаемся на форму входа
                setUsername('');
                setEmail('');
                setPassword('');
            }
        } catch (error) {
            console.error('Ошибка регистрации:', error);
            setAuthMessage(error.response?.data?.error || 'Ошибка при регистрации. Возможно, пользователь уже существует.');
        }
    };

    const handleLogout = async () => {
        try {
            const response = await axios.post(`${API_BASE_URL}/auth/logout/`);
            if (response.status === 200) {
                setIsAuthenticated(false);
                setTasks([]); // Очищаем задачи при выходе
                setCurrentUsername(''); // Очищаем имя пользователя при выходе
                setAuthMessage('Вы вышли из системы.');
                // Очистка всех активных интервалов таймера при выходе
                for (const id in intervalRefs.current) {
                    clearInterval(intervalRefs.current[id]);
                }
                intervalRefs.current = {};
            }
        } catch (error) {
            console.error('Ошибка выхода:', error);
            setAuthMessage(error.response?.data?.error || 'Ошибка при выходе.');
        }
    };

    // --- Функции для работы с задачами (требуют аутентификации) ---
    const fetchTasks = useCallback(async () => {
        if (!isAuthenticated) return; // Не пытаемся получить задачи, если не аутентифицированы
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
            if (error.response && (error.response.status === 401 || error.response.status === 403)) {
                // Если сессия истекла или пользователь не авторизован, перенаправляем на вход
                setIsAuthenticated(false);
                setCurrentUsername(''); // Очищаем имя пользователя
                setAuthMessage('Ваша сессия истекла. Пожалуйста, войдите снова.');
                setTasks([]); // Очищаем задачи
            }
        }
    }, [isAuthenticated]);

    const addTask = async () => {
        if (!isAuthenticated || newTaskName.trim() === '') return;

        try {
            const response = await axios.post(`${API_BASE_URL}/tasks/`, { name: newTaskName });
            setTasks((prevTasks) => [...prevTasks, response.data]);
            setNewTaskName('');
        } catch (error) {
            console.error('Error adding task:', error);
        }
    };

    const toggleTaskTimer = async (id) => {
        if (!isAuthenticated) return;
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
        if (!isAuthenticated) return;
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
        if (!isAuthenticated) return;
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

    // --- Эффекты ---
    useEffect(() => {
        // При загрузке страницы попытаться получить задачи, чтобы проверить сессию
        fetchTasks();
    }, [fetchTasks]);

    useEffect(() => {
        // Очистка интервалов при размонтировании компонента
        return () => {
            for (const id in intervalRefs.current) {
                clearInterval(intervalRefs.current[id]);
            }
        };
    }, []);

    useEffect(() => {
        // Управление интервалами для запущенных задач
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

        // Очистка интервалов для задач, которых больше нет
        const taskIds = new Set(tasks.map(task => task.id));
        for (const id in intervalRefs.current) {
            if (!taskIds.has(parseInt(id))) {
                clearInterval(intervalRefs.current[id]);
                delete intervalRefs.current[id];
            }
        }

        return () => {}; // Возвращаем пустую функцию очистки, так как интервалы управляются выше
    }, [tasks]);


    // --- Рендеринг ---
    return (
        <div className={styles.container}>
            {!isAuthenticated ? (
                // Формы аутентификации
                <div className={styles.authCard}>
                    <h1 className={styles.title}>
                        {isRegistering ? 'Регистрация' : 'Вход'}
                    </h1>
                    {authMessage && <p className={styles.authMessage}>{authMessage}</p>}
                    <form onSubmit={isRegistering ? handleRegister : handleLogin}>
                        <input
                            type="text"
                            className={styles.inputField}
                            placeholder="Имя пользователя"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            required
                        />
                        {isRegistering && (
                            <input
                                type="email"
                                className={styles.inputField}
                                placeholder="Email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                            />
                        )}
                        <input
                            type="password"
                            className={styles.inputField}
                            placeholder="Пароль"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                        <button type="submit" className={styles.authButton}>
                            {isRegistering ? 'Зарегистрироваться' : 'Войти'}
                        </button>
                    </form>
                    <p className={styles.toggleAuth}>
                        {isRegistering ? (
                            <>Уже есть аккаунт?{' '}
                                <span onClick={() => { setIsRegistering(false); setAuthMessage(''); }} className={styles.toggleLink}>
                                    Войти
                                </span>
                            </>
                        ) : (
                            <>Нет аккаунта?{' '}
                                <span onClick={() => { setIsRegistering(true); setAuthMessage(''); }} className={styles.toggleLink}>
                                    Зарегистрироваться
                                </span>
                            </>
                        )}
                    </p>
                </div>
            ) : (
                // Основной интерфейс трекера
                <div className={styles.trackerCard}>
                    <div className={styles.headerControls}> {/* Новый div для заголовка и кнопок */}
                        <h1 className={styles.title}>Тайм-трекер</h1>
                        <div className={styles.userInfo}> {/* Новый div для имени пользователя и кнопки выхода */}
                            {currentUsername && <span className={styles.usernameDisplay}>Привет, {currentUsername}!</span>}
                            <button onClick={handleLogout} className={styles.logoutButton}>
                                Выйти
                            </button>
                        </div>
                    </div>


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
            )}
        </div>
    );
}

export default App;
