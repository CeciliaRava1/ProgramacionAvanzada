import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateTeacherRequests1792800000001 implements MigrationInterface {
  transaction = false;

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE teacher_assignments (
        student_id INT UNSIGNED NOT NULL,
        teacher_id INT UNSIGNED NOT NULL,
        PRIMARY KEY (student_id),
        CONSTRAINT FK_assignment_student FOREIGN KEY (student_id) REFERENCES users(id),
        CONSTRAINT FK_assignment_teacher FOREIGN KEY (teacher_id) REFERENCES users(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    await queryRunner.query(`
      CREATE TABLE teacher_requests (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT,
        student_id INT UNSIGNED NOT NULL,
        teacher_id INT UNSIGNED NOT NULL,
        status VARCHAR(10) NOT NULL,
        pending_student_id INT UNSIGNED GENERATED ALWAYS AS
          (CASE WHEN status = 'pending' THEN student_id ELSE NULL END) STORED,
        PRIMARY KEY (id),
        UNIQUE KEY UQ_pending_teacher_request (pending_student_id),
        INDEX IDX_teacher_pending_requests (teacher_id, status),
        CONSTRAINT CHK_teacher_request_status CHECK (status IN ('pending', 'accepted', 'rejected', 'cancelled')),
        CONSTRAINT FK_request_student FOREIGN KEY (student_id) REFERENCES users(id),
        CONSTRAINT FK_request_teacher FOREIGN KEY (teacher_id) REFERENCES users(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  }

  async down(): Promise<void> {
    throw new Error('La reversión no es automática para evitar borrar solicitudes y vínculos.');
  }
}
