'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

export interface Project {
  id: string;
  name: string;
  createdAt: number;
  modifiedAt: number;
  duration: number;
  data: any;
}

interface ProjectsContextType {
  projects: Project[];
  currentProject: Project | null;
  createProject: (name: string) => Project;
  loadProject: (id: string) => void;
  saveProject: (data: any) => void;
  renameProject: (id: string, name: string) => void;
  deleteProject: (id: string) => void;
  getRecentProjects: (limit?: number) => Project[];
}

const ProjectsContext = createContext<ProjectsContextType | undefined>(undefined);

export function ProjectsProvider({ children }: { children: React.ReactNode }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [mounted, setMounted] = useState(false);

  // Load projects from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('da-music-box-projects');
    if (saved) {
      try {
        setProjects(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to load projects:', e);
      }
    }
    setMounted(true);
  }, []);

  // Save projects to localStorage
  useEffect(() => {
    if (mounted) {
      localStorage.setItem('da-music-box-projects', JSON.stringify(projects));
    }
  }, [projects, mounted]);

  const createProject = (name: string): Project => {
    const project: Project = {
      id: Date.now().toString(),
      name,
      createdAt: Date.now(),
      modifiedAt: Date.now(),
      duration: 0,
      data: {},
    };
    setProjects(prev => [...prev, project]);
    setCurrentProject(project);
    return project;
  };

  const loadProject = (id: string) => {
    const project = projects.find(p => p.id === id);
    if (project) {
      setCurrentProject(project);
    }
  };

  const saveProject = (data: any) => {
    if (!currentProject) return;
    setProjects(prev =>
      prev.map(p =>
        p.id === currentProject.id
          ? { ...p, data, modifiedAt: Date.now() }
          : p
      )
    );
  };

  const renameProject = (id: string, name: string) => {
    setProjects(prev =>
      prev.map(p =>
        p.id === id ? { ...p, name, modifiedAt: Date.now() } : p
      )
    );
    if (currentProject?.id === id) {
      setCurrentProject(prev => prev ? { ...prev, name } : null);
    }
  };

  const deleteProject = (id: string) => {
    setProjects(prev => prev.filter(p => p.id !== id));
    if (currentProject?.id === id) {
      setCurrentProject(null);
    }
  };

  const getRecentProjects = (limit = 5) => {
    return [...projects].sort((a, b) => b.modifiedAt - a.modifiedAt).slice(0, limit);
  };

  return (
    <ProjectsContext.Provider
      value={{
        projects,
        currentProject,
        createProject,
        loadProject,
        saveProject,
        renameProject,
        deleteProject,
        getRecentProjects,
      }}
    >
      {children}
    </ProjectsContext.Provider>
  );
}

export function useProjects() {
  const context = useContext(ProjectsContext);
  if (!context) {
    throw new Error('useProjects must be used within ProjectsProvider');
  }
  return context;
}