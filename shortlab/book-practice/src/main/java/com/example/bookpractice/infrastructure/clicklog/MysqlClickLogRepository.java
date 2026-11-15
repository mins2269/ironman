package com.example.bookpractice.infrastructure.clicklog;

import com.example.bookpractice.domain.ClickLogRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public class MysqlClickLogRepository implements ClickLogRepository {

    private final ClickLogJpaRepository clickLogJpaRepository;

    public MysqlClickLogRepository(ClickLogJpaRepository clickLogJpaRepository) {
        this.clickLogJpaRepository = clickLogJpaRepository;
    }

    @Override
    public void save(String shortenUrlKey, LocalDateTime clickedAt) {
        clickLogJpaRepository.save(new ClickLogEntity(shortenUrlKey, clickedAt));
    }

    @Override
    public List<LocalDateTime> findRecentClickedAt(String shortenUrlKey) {
        return clickLogJpaRepository.findTop20ByShortenUrlKeyOrderByClickedAtDesc(shortenUrlKey)
                .stream()
                .map(ClickLogEntity::getClickedAt)
                .toList();
    }
}