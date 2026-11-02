/*
  file summary: section cards for an assurance set, each opening to the list of tasks still open in it.
  responsibilities: shows open task and certificate counts per section, flags heavy sections, lists each open task with its status and owner when a card is opened, and opens a certificate's document page when that task has a document.
  role in system: used by AssuranceDetailView and ProjectDetailView so both screens show the same cards.
*/

import { useState } from 'react';
import { AssuranceRequirement, AssuranceSet } from '../../types/assurance';
import { useMapStore } from '../../store/useMapStore';
import { isCertificateTask, listOpenTasksInSection, openTaskStatusLabel, summarizeTaskSections } from '../../utils/readinessHelpers';

interface TaskSectionCardsProps {
  set: Pick<AssuranceSet, 'requirements' | 'sections'>;
}

function certificateDocumentId(task: AssuranceRequirement): string | undefined {
  if (!isCertificateTask(task)) return undefined;
  const id = (task.documentId || task.linkedDocumentId || '').trim();
  return id || undefined;
}

export default function TaskSectionCards({ set }: TaskSectionCardsProps) {
  const setCurrentHashView = useMapStore((state) => state.setCurrentHashView);
  const [openSectionId, setOpenSectionId] = useState<string | null>(null);
  const summaries = summarizeTaskSections(set);
  const taskTitle = (id?: string) => set.requirements.find((task) => task.id === id)?.title;

  return (
    <div className="row g-2">
      {summaries.map((section) => {
        const isOpen = openSectionId === section.id;
        const openTasks = isOpen ? listOpenTasksInSection(set, section.id) : [];
        return (
          <div className={isOpen ? 'col-12' : 'col-md-6 col-xl-4'} key={section.id}>
            <div className={`border rounded p-2 h-100 ${section.heavy ? 'border-warning bg-warning-subtle' : ''}`}>
              <button
                type="button"
                className="btn btn-link text-start text-decoration-none p-0 w-100"
                aria-expanded={isOpen}
                disabled={section.remainingTasks === 0}
                onClick={() => setOpenSectionId(isOpen ? null : section.id)}
              >
                <div className="d-flex align-items-center justify-content-between gap-2">
                  <span className="fw-semibold text-dark">{section.name}</span>
                  {section.heavy && <span className="badge bg-warning text-dark">Heavy</span>}
                </div>
                <div className="small text-secondary mt-1">
                  {section.remainingTasks} {section.remainingTasks === 1 ? 'task' : 'tasks'} open · {section.remainingCertificates}{' '}
                  {section.remainingCertificates === 1 ? 'certificate' : 'certificates'} open
                  {section.remainingTasks > 0 && <span className="ms-2">{isOpen ? 'Hide tasks' : 'Show tasks'}</span>}
                </div>
              </button>
              {isOpen && (
                <ul className="list-unstyled small mb-0 mt-2 border-top pt-2">
                  {openTasks.map((task) => {
                    const documentId = certificateDocumentId(task);
                    return (
                    <li className="d-flex flex-wrap justify-content-between gap-2 py-1" key={task.id}>
                      <span className="text-dark">
                        {documentId ? (
                          <button
                            type="button"
                            className="btn btn-link p-0 align-baseline text-start fw-semibold"
                            onClick={() => setCurrentHashView('documents', documentId)}
                          >
                            {task.title}
                          </button>
                        ) : (
                          task.title
                        )}
                        {taskTitle(task.predecessorId) && (
                          <span className="text-secondary"> · After {taskTitle(task.predecessorId)}</span>
                        )}
                      </span>
                      <span className="text-secondary">
                        {openTaskStatusLabel(task)}
                        {(task.assignedSubmitter || task.assignedVerifier) &&
                          ` · ${task.assignedSubmitter || task.assignedVerifier}`}
                      </span>
                    </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
