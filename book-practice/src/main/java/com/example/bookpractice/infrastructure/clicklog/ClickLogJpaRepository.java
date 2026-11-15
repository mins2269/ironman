package com.example.bookpractice.infrastructure.clicklog;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ClickLogJpaRepository extends JpaRepository<ClickLogEntity, Long> {

    List<ClickLogEntity> findTop20ByShortenUrlKeyOrderByClickedAtDesc(String shortenUrlKey);
}